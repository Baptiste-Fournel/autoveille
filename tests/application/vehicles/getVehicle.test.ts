import { describe, expect, it } from 'vitest';
import { getVehicle } from '../../../src/application/vehicles/getVehicle.js';
import { VehicleNotFound } from '../../../src/application/vehicles/vehicleNotFound.js';
import { newListing } from '../../../src/domain/vehicle/changes.js';
import { priceChangeDetail, sightingDetail } from '../../../src/domain/vehicle/events.js';
import { MAZDA_5, MERCEDES_C63, MERCEDES_C63_REPOSTED, PORSCHE_911_4S, storeFirstSighting } from '../../contracts/vehicleSamples.js';
import { fakeClock } from '../../fakes/fakeClock.js';
import { fakePersistence } from '../../fakes/fakePersistence.js';

const KEPT = { matched: true, rejections: [] } as const;

const world = () => ({ ...fakePersistence(), clock: fakeClock() });

describe('la fiche d’une annonce', () => {
  it('la fiche de la 911 dont le prix a baissé montre son annonce, l’historique de prix et les événements, du plus récent au plus ancien', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-12T07:10:00.000Z', KEPT);
    app.vehicles.addPricePoint(porsche.listingId, { price: 112900, seenAt: '2026-10-12T07:10:00.000Z' });
    app.vehicles.addEvent(porsche.vehicleId, {
      type: 'nouveau',
      detail: sightingDetail('Leboncoin', PORSCHE_911_4S.url),
      at: '2026-10-12T07:10:00.000Z',
    });
    app.vehicles.addPricePoint(porsche.listingId, { price: 109900, seenAt: '2026-10-14T06:45:00.000Z' });
    app.vehicles.addEvent(porsche.vehicleId, {
      type: 'prix_baisse',
      detail: priceChangeDetail(112900, 109900),
      at: '2026-10-14T06:45:00.000Z',
    });
    app.vehicles.recordVehicleSighting(porsche.vehicleId, { price: 109900, priceDropped: true, lastSeenAt: '2026-10-14T06:45:00.000Z' });

    // When
    const sheet = getVehicle(app, porsche.vehicleId);

    // Then
    expect(sheet.vehicle).toMatchObject({ id: porsche.vehicleId, price: 109900, priceDropped: true });
    expect(sheet.listings.map((listing) => listing.externalId)).toEqual(['2811001234']);
    expect(sheet.priceHistories.get(porsche.listingId)).toEqual([
      { price: 112900, seenAt: '2026-10-12T07:10:00.000Z' },
      { price: 109900, seenAt: '2026-10-14T06:45:00.000Z' },
    ]);
    expect(sheet.events.map((event) => [event.type, event.detail])).toEqual([
      ['prix_baisse', '112900 → 109900'],
      ['nouveau', 'Leboncoin https://www.leboncoin.fr/ad/voitures/2811001234'],
    ]);
  });

  it('la fiche de la Mercedes republiée sur La Centrale montre ses deux annonces, la première lue en tête, chacune avec son historique', () => {
    // Given
    const app = world();
    const mercedes = storeFirstSighting(app.vehicles, MERCEDES_C63, '2026-10-10T09:00:00.000Z', KEPT);
    app.vehicles.addPricePoint(mercedes.listingId, { price: 64900, seenAt: '2026-10-10T09:00:00.000Z' });
    const repost = app.vehicles.addListing(mercedes.vehicleId, newListing(MERCEDES_C63_REPOSTED, '2026-10-13T08:00:00.000Z'));
    app.vehicles.addPricePoint(repost, { price: 62900, seenAt: '2026-10-13T08:00:00.000Z' });
    app.vehicles.recordVehicleSighting(mercedes.vehicleId, { reposted: true, lastSeenAt: '2026-10-13T08:00:00.000Z' });

    // When
    const sheet = getVehicle(app, mercedes.vehicleId);

    // Then
    expect(sheet.listings.map((listing) => listing.externalId)).toEqual(['69112345678', '69112345999']);
    expect(sheet.priceHistories.get(mercedes.listingId)).toEqual([{ price: 64900, seenAt: '2026-10-10T09:00:00.000Z' }]);
    expect(sheet.priceHistories.get(repost)).toEqual([{ price: 62900, seenAt: '2026-10-13T08:00:00.000Z' }]);
    expect(sheet.vehicle.reposted).toBe(true);
  });

  it('la fiche de la 911 à 112 900 € dit qu’elle est gardée pour son prix, au-dessus du plancher de 40 000 € des allemandes', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-12T07:10:00.000Z', KEPT);

    // When
    const sheet = getVehicle(app, porsche.vehicleId);

    // Then
    expect(sheet.specialReason).toEqual({ kind: 'priceFloor', minPrice: 40000 });
  });

  it('une Mazda 5 gardée quand même, rangée dans les autres marques, n’a pas de raison « supercar ou collection »', () => {
    // Given
    const app = world();
    const mazda = storeFirstSighting(app.vehicles, MAZDA_5, '2026-10-13T07:02:00.000Z', KEPT);

    // When
    const sheet = getVehicle(app, mazda.vehicleId);

    // Then
    expect(sheet.vehicle.family).toBe('autres');
    expect(sheet.specialReason).toBeUndefined();
  });

  it('la fiche propose le message à envoyer au vendeur de la 911, rédigé d’après sa première annonce', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-12T07:10:00.000Z', KEPT);

    // When
    const sheet = getVehicle(app, porsche.vehicleId);

    // Then
    expect(sheet.message).toContain('Porsche 911 Carrera 4S');
  });

  it('la fiche de la C63 S vue d’abord sur La Centrale puis sur Leboncoin propose le message écrit pour l’annonce La Centrale', () => {
    // Given
    const app = world();
    const mercedes = storeFirstSighting(app.vehicles, MERCEDES_C63, '2026-10-10T09:00:00.000Z', KEPT);
    app.vehicles.addListing(
      mercedes.vehicleId,
      newListing(
        {
          ...MERCEDES_C63,
          site: 'leboncoin',
          siteLabel: 'Leboncoin',
          externalId: '2811012345',
          url: 'https://www.leboncoin.fr/ad/voitures/2811012345',
          title: 'Mercedes-AMG C63 S Coupé 510ch',
        },
        '2026-10-13T08:00:00.000Z',
      ),
    );

    // When
    const sheet = getVehicle(app, mercedes.vehicleId);

    // Then
    expect(sheet.message).toContain('sur La Centrale');
    expect(sheet.message).not.toContain('Leboncoin');
  });

  it('la fiche d’une annonce supprimée depuis un autre appareil est introuvable', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-12T07:10:00.000Z', KEPT);
    app.vehicles.deleteVehicle(porsche.vehicleId);

    // When
    const opening = () => getVehicle(app, porsche.vehicleId);

    // Then
    expect(opening).toThrow(VehicleNotFound);
  });
});
