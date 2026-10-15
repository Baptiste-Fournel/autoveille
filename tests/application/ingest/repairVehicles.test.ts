import { describe, expect, it } from 'vitest';
import { repairVehicles } from '../../../src/application/ingest/repairVehicles.js';
import { newListing } from '../../../src/domain/vehicle/changes.js';
import { EVENT_TYPES } from '../../../src/domain/vehicle/events.js';
import type { RawListing, Vehicle } from '../../../src/domain/vehicle/types.js';
import { FAKE_NOW } from '../../fakes/fakeClock.js';
import { TALENCE } from '../../fakes/fakeGeocoder.js';
import { type IngestWorld, ingest, ingestWorld } from '../../support/ingestWorld.js';
import { leboncoinListing } from '../../support/knownVehicle.js';

const MERGED_AT = '2026-10-15T08:31:00.000Z';

const leboncoinAd = (externalId: string, title: string, fields: Partial<RawListing> = {}): RawListing =>
  leboncoinListing(title, { externalId, url: `https://www.leboncoin.fr/ad/voitures/${externalId}`, ...fields });

const rangerRaptor = leboncoinAd('2811001000', 'Ford Autres - Ford ranger raptor', { price: 61900, km: 46000, year: 2024 });

const mustangMergedByMistake = (fields: Partial<RawListing> = {}): RawListing =>
  leboncoinAd('2811001001', 'Ford Autres - Ford Mustang GT', { price: 54000, km: 45000, year: 2024, ...fields });

const stored = (world: IngestWorld, id: number): Vehicle => {
  const vehicle = world.vehicles.vehicle(id);
  if (vehicle === undefined) {
    throw new Error(`aucune voiture ${id}`);
  }
  return vehicle;
};

const mergedByAnOlderVersion = async (world: IngestWorld, mustang: RawListing): Promise<number> => {
  const raptor = await ingest(world, rangerRaptor);
  world.vehicles.addListing(raptor.vehicleId, newListing(mustang, MERGED_AT));
  world.vehicles.applyRegrouping(raptor.vehicleId, { make: 'Ford', model: 'Autres', reposted: true });
  return raptor.vehicleId;
};

describe('réparation des voitures enregistrées', () => {
  it('réparation : la Ford « Autres » devient un ranger raptor, la Mustang fusionnée à tort redevient une voiture à part, et une deuxième passe ne change rien', async () => {
    // Given
    const world = ingestWorld();
    const fordId = await mergedByAnOlderVersion(world, mustangMergedByMistake());

    // When
    const summary = await repairVehicles(world.dependencies);

    // Then
    expect(summary).toMatchObject({ vehicles: 1, renamed: 1, split: 1 });
    const ford = stored(world, fordId);
    expect(ford.model).toBe('ranger raptor');
    expect(ford.reposted).toBe(false);
    expect(world.vehicles.listingsOf(ford.id)).toHaveLength(1);
    const added = world.vehicles.allVehicles().find((vehicle) => vehicle.id !== ford.id);
    expect(added).toMatchObject({ make: 'Ford', model: 'Mustang GT', price: 54000, km: 45000, status: 'nouveau', reposted: false });
    expect(world.vehicles.listingsOf(added?.id ?? 0).map((listing) => listing.externalId)).toEqual(['2811001001']);

    // When
    const secondPass = await repairVehicles(world.dependencies);

    // Then
    expect(secondPass).toMatchObject({ renamed: 0, split: 0, reevaluated: 0 });
  });

  it('la Mustang de Talence fusionnée à tort avec le ranger raptor de Pessac en ressort placée à Talence, à sa propre distance', async () => {
    // Given
    const world = ingestWorld();
    await mergedByAnOlderVersion(world, mustangMergedByMistake({ city: 'Talence', postalCode: '33400' }));

    // When
    await repairVehicles(world.dependencies);

    // Then
    const mustang = world.vehicles.allVehicles().find((vehicle) => vehicle.model === 'Mustang GT');
    expect(mustang).toMatchObject({ city: 'Talence', postalCode: '33400', lat: TALENCE.lat, lon: TALENCE.lon });
    expect(Math.round(mustang?.distanceKm ?? 0)).toBe(3);
    expect(world.geocoder.queries()).toContainEqual({ city: 'Talence', postalCode: '33400' });
    expect(world.vehicles.events(mustang?.id ?? 0)).toEqual([
      expect.objectContaining({ type: 'nouveau', detail: 'Leboncoin', at: MERGED_AT }),
    ]);
  });

  it('la réparation ne touche ni au statut ni au verdict d’une 911 contactée il y a trois semaines, bien que le plafond soit passé à 90 000 km', async () => {
    // Given
    const world = ingestWorld();
    world.clock.set('2026-09-24T08:30:00.000Z');
    await ingest(world, leboncoinAd('2810887766', 'Porsche 911 Carrera S 2015 95 000 km 74 900 €'));
    world.vehicles.applyVehicleUpdate(1, { status: 'contacte' });
    world.vehicles.addEvent(1, { type: EVENT_TYPES.markedContacted, detail: null, at: '2026-09-24T17:20:00.000Z' });
    world.clock.set(FAKE_NOW);
    world.settings.save({ ...world.settings.load(), maxKm: 90000 });

    // When
    const summary = await repairVehicles(world.dependencies);

    // Then
    expect(summary).toEqual({ vehicles: 1, renamed: 0, split: 0, reevaluated: 0 });
    expect(stored(world, 1)).toMatchObject({ status: 'contacte', matched: true, rejections: [] });
  });
  it('« Réparer » retient la 911 à 120 000 km reçue il y a trois semaines, maintenant que le plafond est à 150 000 km', async () => {
    // Given
    const world = ingestWorld();
    world.clock.set('2026-09-24T08:30:00.000Z');
    await ingest(world, leboncoinAd('2810887799', 'Porsche 911 Carrera S 2015 120 000 km 69 900 €'));
    const received = stored(world, 1);
    world.clock.set(FAKE_NOW);
    world.settings.save({ ...world.settings.load(), maxKm: 150000 });

    // When
    const summary = await repairVehicles(world.dependencies);

    // Then
    expect(received).toMatchObject({ matched: false, rejections: [{ kind: 'mileageAbove', km: 120000, maxKm: 100000 }] });
    expect(summary).toEqual({ vehicles: 1, renamed: 0, split: 0, reevaluated: 1 });
    expect(stored(world, 1)).toMatchObject({ status: 'nouveau', matched: true, rejections: [] });
  });
});
