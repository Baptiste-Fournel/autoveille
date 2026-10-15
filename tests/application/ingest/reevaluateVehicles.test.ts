import { describe, expect, it } from 'vitest';
import { reevaluateVehicles } from '../../../src/application/ingest/reevaluateVehicles.js';
import { describeRejection } from '../../../src/domain/presentation/reasons.js';
import type { Settings } from '../../../src/domain/settings/types.js';
import { EVENT_TYPES } from '../../../src/domain/vehicle/events.js';
import type { RawListing, Vehicle } from '../../../src/domain/vehicle/types.js';
import { FAKE_NOW } from '../../fakes/fakeClock.js';
import { type IngestWorld, ingest, ingestWorld } from '../../support/ingestWorld.js';
import { LEBONCOIN_911_TITLE, leboncoinListing } from '../../support/knownVehicle.js';

const leboncoinAd = (externalId: string, title: string, fields: Partial<RawListing> = {}): RawListing =>
  leboncoinListing(title, { externalId, url: `https://www.leboncoin.fr/ad/voitures/${externalId}`, ...fields });

const porsche911 = leboncoinListing(LEBONCOIN_911_TITLE);

const audiA3 = leboncoinAd('2811004567', 'Audi A3 Sportback 2019 35 000 km 22 000 €');

const stored = (world: IngestWorld, id: number): Vehicle => {
  const vehicle = world.vehicles.vehicle(id);
  if (vehicle === undefined) {
    throw new Error(`aucune voiture ${id}`);
  }
  return vehicle;
};

const withRadius = (settings: Settings, radiusKm: number): Settings => ({ ...settings, zone: { ...settings.zone, radiusKm } });

describe('réévaluation des voitures de la semaine', () => {
  it('désactiver « Supercar et collection » fait passer l’Audi A3 de la semaine parmi les retenues, sans la notifier', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);
    await ingest(world, audiA3);
    const saved = world.settings.load();
    const relaxed: Settings = { ...saved, specialOnly: false };

    // When
    const withSavedSettings = reevaluateVehicles(world.dependencies, { settings: saved, persist: false });
    const preview = reevaluateVehicles(world.dependencies, { settings: relaxed, persist: false });
    const afterPreview = stored(world, 2).matched;
    reevaluateVehicles(world.dependencies, { settings: relaxed, persist: true });

    // Then
    expect(withSavedSettings).toEqual({ total: 2, pass: 1 });
    expect(preview).toEqual({ total: 2, pass: 2 });
    expect(afterPreview).toBe(false);
    expect(stored(world, 2).matched).toBe(true);
    expect(world.channel.pushes()).toHaveLength(1);
  });

  it('un rayon ramené de 100 à 20 km écarte la 911 de Libourne déjà en base, à 28 km de Bordeaux', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, leboncoinAd('2811007788', LEBONCOIN_911_TITLE, { city: 'Libourne', postalCode: '33500' }));
    const narrowed = withRadius(world.settings.load(), 20);

    // When
    const preview = reevaluateVehicles(world.dependencies, { settings: narrowed, persist: true });

    // Then
    expect(preview).toEqual({ total: 1, pass: 0 });
    const [reason, ...others] = stored(world, 1).rejections;
    expect(reason === undefined ? '' : describeRejection(reason)).toBe('à 28 km, hors du rayon de 20 km');
    expect(others).toEqual([]);
    expect(stored(world, 1).matched).toBe(false);
  });

  it('la concession s’installe à Libourne : la distance de la 911 de Pessac est recalculée depuis sa position, sans chercher la ville de nouveau', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);
    const fromBordeaux = stored(world, 1).distanceKm;
    const saved = world.settings.load();
    const moved: Settings = { ...saved, zone: { ...saved.zone, city: 'Libourne', postalCode: '33500', lat: 44.915, lon: -0.2436 } };

    // When
    reevaluateVehicles(world.dependencies, { settings: moved, persist: true });

    // Then
    expect(Math.round(fromBordeaux ?? 0)).toBe(5);
    expect(Math.round(stored(world, 1).distanceKm ?? 0)).toBe(33);
    expect(world.geocoder.queries()).toHaveLength(1);
  });

  it('ajouter Toyota aux allemandes reclasse la Toyota Supra reçue cette semaine parmi les allemandes retenues', async () => {
    // Given
    const world = ingestWorld();
    await ingest(
      world,
      leboncoinAd('2811006655', 'Toyota Supra 3.0 GR 340ch 2020 18 000 km 52 900 €', { city: 'Mérignac', postalCode: '33700' }),
    );
    const received = stored(world, 1);
    const saved = world.settings.load();
    const allemandes = saved.families.allemandes;
    const withToyota: Settings = {
      ...saved,
      families: {
        ...saved.families,
        allemandes: { ...allemandes, brands: [...allemandes.brands, 'Toyota'], known: [...allemandes.known, 'Toyota'] },
      },
    };

    // When
    reevaluateVehicles(world.dependencies, { settings: withToyota, persist: true });

    // Then
    expect(received).toMatchObject({ family: 'autres', matched: false, rejections: [{ kind: 'unfollowedBrand', make: 'Toyota' }] });
    expect(stored(world, 1)).toMatchObject({ make: 'Toyota', family: 'allemandes', matched: true, rejections: [] });
  });

  it('une Artega GT reçue avant que la marque soit ajoutée aux allemandes est nommée et retenue à l’enregistrement des réglages', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, leboncoinAd('2811002211', 'Artega GT 2009 28 000 km 42 000 €', { city: 'Mérignac', postalCode: '33700' }));
    const received = stored(world, 1);
    const saved = world.settings.load();
    const allemandes = saved.families.allemandes;
    const withArtega: Settings = {
      ...saved,
      families: {
        ...saved.families,
        allemandes: { ...allemandes, brands: [...allemandes.brands, 'Artega'], known: [...allemandes.known, 'Artega'] },
      },
    };

    // When
    reevaluateVehicles(world.dependencies, { settings: withArtega, persist: true });

    // Then
    expect(received).toMatchObject({ make: null, matched: false });
    expect(stored(world, 1)).toMatchObject({ make: 'Artega', family: 'allemandes', matched: true, rejections: [] });
  });

  it('une Audi A3 arrivée il y a dix jours n’est ni comptée ni reclassée quand on désactive « Supercar et collection »', async () => {
    // Given
    const world = ingestWorld();
    world.clock.set('2026-10-05T08:30:00.000Z');
    await ingest(world, audiA3);
    world.clock.set(FAKE_NOW);
    const relaxed: Settings = { ...world.settings.load(), specialOnly: false };

    // When
    const preview = reevaluateVehicles(world.dependencies, { settings: relaxed, persist: true });

    // Then
    expect(preview).toEqual({ total: 0, pass: 0 });
    expect(stored(world, 1).matched).toBe(false);
  });

  it('comportement hérité : une Clio gardée à la main puis contactée repasse parmi les écartées quand on enregistre les réglages', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, leboncoinAd('2811003344', 'Renault Clio 1.2 2016 60 000 km 7 500 €', { city: 'Talence', postalCode: '33400' }));
    world.vehicles.applyVehicleUpdate(1, { status: 'nouveau', matched: true, rejections: [] });
    world.vehicles.addEvent(1, { type: EVENT_TYPES.markedNew, detail: null, at: '2026-10-15T08:35:00.000Z' });
    world.vehicles.addEvent(1, { type: EVENT_TYPES.keptAnyway, detail: null, at: '2026-10-15T08:35:00.000Z' });
    world.vehicles.applyVehicleUpdate(1, { status: 'contacte' });
    world.vehicles.addEvent(1, { type: EVENT_TYPES.markedContacted, detail: null, at: '2026-10-15T09:10:00.000Z' });
    const widened = withRadius(world.settings.load(), 150);

    // When
    reevaluateVehicles(world.dependencies, { settings: widened, persist: true });

    // Then
    expect(stored(world, 1)).toMatchObject({ status: 'contacte', matched: false, rejections: [{ kind: 'notSpecial' }] });
  });
});
