import { beforeEach, describe, expect, it } from 'vitest';
import { rawToListingRow, Store } from './db.js';
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
  const drops: string[] = [];

  beforeEach(() => {
    store = new Store(':memory:');
    notified.length = 0; drops.length = 0;
    pipeline = new Pipeline(store, { newVehicle: async (v) => { notified.push(v.fingerprint); }, priceDrop: async (v, _raw, from, to) => { drops.push(`${v.id}:${from}>${to}`); } });
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
    expect(drops).toEqual(['1:89900>84900']);
    // A rise is not a nudge; a drop on an ignored vehicle is not one either.
    await pipeline.ingest(raw({ price: 86900 }));
    store.updateVehicle(1, { status: 'ignore' });
    await pipeline.ingest(raw({ price: 80000 }));
    expect(drops).toHaveLength(1);
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

  it('completes a listing first read without price, and refreshes the verdict', async () => {
    const first = await pipeline.ingest(raw({ title: 'Porsche 911 Carrera S', price: undefined, km: 42000, year: 2015, description: undefined, imageUrl: undefined }));
    expect(first.kind).toBe('new');
    let v = store.getVehicle(first.vehicleId)!;
    expect(v.price).toBeNull();
    expect(v.matched).toBe(1); // modèle « 911 » suffit
    const again = await pipeline.ingest(raw({ title: 'Porsche 911 Carrera S', price: 89900, km: 42000, year: 2015, description: 'Texte reçu', imageUrl: 'https://img/x.jpg' }));
    expect(again.kind).toBe('seen');
    v = store.getVehicle(first.vehicleId)!;
    expect(v.price).toBe(89900);
    expect(store.listingsOfVehicle(v.id)[0]).toMatchObject({ price: 89900, image_url: 'https://img/x.jpg', description: 'Texte reçu' });
    expect(store.events(v.id).some((e) => e.type.startsWith('prix_'))).toBe(false);
  });

  it('counts the week from events, and forgets a contact that was undone', async () => {
    await pipeline.ingest(raw());
    const now = new Date().toISOString();
    store.updateVehicle(1, { status: 'contacte' }); store.addEvent(1, 'statut_contacte', null, now);
    expect(store.weekStats(7)).toEqual({ received: 1, contacted: 1, replied: 0 });
    expect(store.lastEventAt(1, 'statut_contacte')).toBe(now);
    store.deleteEvents(1, ['statut_contacte', 'statut_repondu']); store.updateVehicle(1, { status: 'nouveau' });
    expect(store.weekStats(7)).toEqual({ received: 1, contacted: 0, replied: 0 });
    expect(store.lastEventAt(1, 'statut_contacte')).toBeNull();
  });

  it('deletes a vehicle with everything attached, and can forget the read emails', async () => {
    const out = await pipeline.ingest(raw());
    store.markEmail({ message_id: '<a>', uid: 7, subject: 's', sender: 'x@y', received_at: null, site: 'leboncoin', parsed_count: 1, parsed_json: null, error: null });
    store.deleteVehicle(out.vehicleId);
    expect(store.getVehicle(out.vehicleId)).toBeUndefined();
    expect(store.listingsOfVehicle(out.vehicleId)).toHaveLength(0);
    store.resetMailbox();
    expect(store.emailProcessed('<a>')).toBe(false);
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

  it('repair: renames vehicles with the current rules and separates listings merged by mistake', async () => {
    const out = await pipeline.ingest(raw({ title: 'Ford Autres - Ford ranger raptor', price: 61900, km: 46000, year: 2024 }));
    // An older version merged a different car into this vehicle (same placeholder model, close kilometres).
    const other = raw({ externalId: '101', url: 'https://www.leboncoin.fr/ad/voitures/101', title: 'Ford Autres - Ford Mustang GT', price: 54000, km: 45000, year: 2024 });
    store.insertListing(rawToListingRow(other, out.vehicleId, new Date(Date.now() + 60_000).toISOString()));
    store.updateVehicle(out.vehicleId, { make: 'Ford', model: 'Autres', reposted: 1 });
    const r = await pipeline.repair(store.getSettings());
    expect(r).toMatchObject({ vehicles: 1, renamed: 1, split: 1 });
    const v = store.getVehicle(out.vehicleId)!;
    expect(v.model).toBe('ranger raptor');
    expect(v.reposted).toBe(0);
    expect(store.listingsOfVehicle(v.id)).toHaveLength(1);
    const added = store.allVehicles().find((x) => x.id !== v.id)!;
    expect(added).toMatchObject({ make: 'Ford', model: 'Mustang GT', price: 54000, km: 45000, status: 'nouveau', reposted: 0 });
    expect(store.listingsOfVehicle(added.id).map((l) => l.external_id)).toEqual(['101']);
    // A second pass changes nothing.
    expect(await pipeline.repair(store.getSettings())).toMatchObject({ renamed: 0, split: 0, reevaluated: 0 });
  });
});

describe('alert confirmations', () => {
  it('keeps the newest confirmation when an older email is read again', () => {
    const store = new Store(':memory:');
    store.recordAlert({ site: 'lacentrale', criteria: '200 km, 150 000 km', confirmedAt: '2026-10-14T20:00:00.000Z', radiusKm: 200, maxKm: 150000 });
    store.recordAlert({ site: 'lacentrale', criteria: '100 km, 100 000 km', confirmedAt: '2026-10-14T15:33:00.000Z', radiusKm: 100, maxKm: 100000 });
    expect(store.getSettings().alerts.lacentrale.radiusKm).toBe(200);
    store.recordAlert({ site: 'lacentrale', criteria: '250 km', confirmedAt: '2026-10-15T09:00:00.000Z', radiusKm: 250, maxKm: 150000 });
    expect(store.getSettings().alerts.lacentrale.radiusKm).toBe(250);
  });
});
