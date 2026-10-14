import { beforeEach, describe, expect, it } from 'vitest';
import { Store } from './db.js';
import { Pipeline } from './pipeline.js';
import { setGeoFetch } from './geo/geo.js';
import type { RawListing } from './types.js';

setGeoFetch(null); // offline in tests

const raw = (over: Partial<RawListing> = {}): RawListing => ({
  site: 'leboncoin', siteLabel: 'Leboncoin', externalId: '100', url: 'https://www.leboncoin.fr/ad/voitures/100',
  title: 'Porsche 911 Carrera S 2015 42 000 km 89 900 €', city: 'Pessac', postalCode: '33600', sellerType: 'particulier', ...over,
});

describe('pipeline', () => {
  let store: Store;
  let pipeline: Pipeline;
  const notified: string[] = [];

  beforeEach(() => {
    store = new Store(':memory:');
    notified.length = 0;
    pipeline = new Pipeline(store, { newVehicle: async (v) => { notified.push(v.fingerprint); } });
  });

  it('creates, matches and notifies a new vehicle, with distance from the built-in table', async () => {
    const out = await pipeline.ingest(raw());
    expect(out.kind).toBe('new');
    const v = store.getVehicle(1)!;
    expect(v.matched).toBe(1);
    expect(v.distance_km).toBeGreaterThan(0);
    expect(v.distance_km).toBeLessThan(15);
    expect(notified).toHaveLength(1);
    expect(pipeline.messageFor(v, store.getSettings())).toContain('Porsche 911 Carrera S');
  });

  it('stores unmatched vehicles with reasons and does not notify', async () => {
    const out = await pipeline.ingest(raw({ title: 'Renault Clio 1.2 2016 60 000 km 7 500 €' }));
    expect(out).toMatchObject({ kind: 'new', matched: false });
    expect(notified).toHaveLength(0);
    expect(JSON.parse(store.getVehicle(1)!.reasons)[0]).toMatch(/ni supercar/);
  });

  it('records a price change without re-notifying', async () => {
    await pipeline.ingest(raw());
    const out = await pipeline.ingest(raw({ price: 84900 }));
    expect(out).toMatchObject({ kind: 'price', from: 89900, to: 84900 });
    expect(store.getVehicle(1)!.price_dropped).toBe(1);
    expect(store.priceHistory(1)).toHaveLength(2);
    expect(notified).toHaveLength(1);
    expect(store.getVehicle(1)!.status).toBe('nouveau');
  });

  it('treats a repost (new id, same car) as the same vehicle, keeping its status', async () => {
    await pipeline.ingest(raw());
    store.updateVehicle(1, { status: 'contacte' });
    const out = await pipeline.ingest(raw({ externalId: '101', url: 'https://www.leboncoin.fr/ad/voitures/101' }));
    expect(out).toMatchObject({ kind: 'repost', vehicleId: 1 });
    expect(store.getVehicle(1)!.status).toBe('contacte');
    expect(store.getVehicle(1)!.reposted).toBe(1);
    expect(store.listingsOfVehicle(1)).toHaveLength(2);
    expect(notified).toHaveLength(1);
  });

  it('links the same car seen on another site', async () => {
    await pipeline.ingest(raw());
    const out = await pipeline.ingest(raw({ site: 'lacentrale', siteLabel: 'La Centrale', externalId: 'x', url: 'https://www.lacentrale.fr/x', title: 'PORSCHE 911 CARRERA S PDK', year: 2015, km: 43000, price: 88500 }));
    expect(out).toMatchObject({ kind: 'other_site', vehicleId: 1 });
    expect(store.getVehicle(1)!.reposted).toBe(0);
  });

  it('re-evaluates recent vehicles when settings change', async () => {
    await pipeline.ingest(raw());
    await pipeline.ingest(raw({ externalId: '2', title: 'Audi A3 Sportback 2019 35 000 km 22 000 €' }));
    const settings = store.getSettings();
    expect((await pipeline.reevaluate(settings)).pass).toBe(1);
    settings.specialOnly = false;
    expect((await pipeline.reevaluate(settings)).pass).toBe(2);
    await pipeline.reevaluate(settings, 7, true);
    expect(store.getVehicle(2)!.matched).toBe(1);
    expect(notified).toHaveLength(1);
  });
});
