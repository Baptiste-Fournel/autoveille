import { describe, expect, it } from 'vitest';
import { NoDateToRecord, PUBLISHED_DATES_LIMIT, recordPublishedDates } from '../../../src/application/ingest/recordPublishedDates.js';
import type { ImportedPublicationDate } from '../../../src/domain/ingest/imports.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import { type IngestWorld, ingest, ingestWorld } from '../../support/ingestWorld.js';
import { LEBONCOIN_911_TITLE, leboncoinListing } from '../../support/knownVehicle.js';

const porsche911 = leboncoinListing(LEBONCOIN_911_TITLE);

const mustang = leboncoinListing('Ford Mustang GT 5.0 V8 Fastback', {
  externalId: '2811005678',
  url: 'https://www.leboncoin.fr/ad/voitures/2811005678',
  price: 42000,
  km: 31000,
  year: 2018,
  city: 'Arcachon',
  postalCode: '33120',
});

const porsche911OnLaCentrale: RawListing = {
  ...porsche911,
  site: 'lacentrale',
  siteLabel: 'La Centrale',
  externalId: '69115730042',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69115730042.html',
  title: 'PORSCHE 911 CARRERA S PDK',
  year: 2015,
  km: 43000,
  price: 88500,
};

const listingOf = (world: IngestWorld, listing: RawListing) => world.vehicles.findListing(listing.site, listing.externalId);

describe('dates de mise en ligne relevées sur les pages d’annonces', () => {
  it('des dates relevées sur les pages d’annonces complètent les annonces connues sans créer de voiture ni notifier', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);
    await ingest(world, mustang);
    const notificationsBefore = world.channel.pushes().length;

    // When
    const summary = recordPublishedDates(world.dependencies, [
      { site: 'leboncoin', externalId: '2811001234', publishedAt: '2026-10-11T08:15:00+02:00' },
      { site: 'leboncoin', externalId: '2811005678', publishedAt: '2026-10-09' },
    ]);

    // Then
    expect(summary).toEqual({ received: 2, updated: 2, unknown: 0, skipped: 0 });
    expect(listingOf(world, porsche911)?.listing.publishedAt).toBe('2026-10-11T06:15:00.000Z');
    expect(listingOf(world, mustang)?.vehicle.publishedAt).toBe('2026-10-09T00:00:00.000Z');
    expect(world.vehicles.allVehicles()).toHaveLength(2);
    expect(world.channel.pushes()).toHaveLength(notificationsBefore);
  });

  it('une date relevée sur la page Leboncoin remplace celle de l’annonce, mais la 911 garde la date plus ancienne de La Centrale', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, { ...porsche911OnLaCentrale, publishedAt: '2026-10-02T07:40:00.000Z' });
    await ingest(world, { ...porsche911, publishedAt: '2026-10-12T16:00:00.000Z' });

    // When
    recordPublishedDates(world.dependencies, [{ site: 'leboncoin', externalId: '2811001234', publishedAt: '2026-10-13T09:00:00+02:00' }]);

    // Then
    expect(listingOf(world, porsche911)?.listing.publishedAt).toBe('2026-10-13T07:00:00.000Z');
    expect(listingOf(world, porsche911)?.vehicle.publishedAt).toBe('2026-10-02T07:40:00.000Z');
  });

  it('la 911 republiée sur Leboncoin : une date plus ancienne relevée sur la page de la republication devient celle de la voiture', async () => {
    // Given
    const world = ingestWorld();
    const repost = { ...porsche911, externalId: '2811009876', url: 'https://www.leboncoin.fr/ad/voitures/2811009876' };
    await ingest(world, { ...porsche911, publishedAt: '2026-10-05T09:00:00.000Z' });
    await ingest(world, repost);

    // When
    const summary = recordPublishedDates(world.dependencies, [
      { site: 'leboncoin', externalId: '2811009876', publishedAt: '2026-10-02T10:00:00+02:00' },
    ]);

    // Then
    expect(summary).toEqual({ received: 1, updated: 1, unknown: 0, skipped: 0 });
    expect(listingOf(world, repost)?.listing.publishedAt).toBe('2026-10-02T08:00:00.000Z');
    expect(listingOf(world, repost)?.vehicle.publishedAt).toBe('2026-10-02T08:00:00.000Z');
    expect(listingOf(world, porsche911)?.listing.publishedAt).toBe('2026-10-05T09:00:00.000Z');
  });

  it('une date relevée pour une annonce que l’application n’a jamais reçue est comptée « inconnue »', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);

    // When
    const summary = recordPublishedDates(world.dependencies, [
      { site: 'leboncoin', externalId: '2899999999', publishedAt: '2026-10-11T08:15:00+02:00' },
    ]);

    // Then
    expect(summary).toEqual({ received: 1, updated: 0, unknown: 1, skipped: 0 });
    expect(world.vehicles.allVehicles()).toHaveLength(1);
    expect(listingOf(world, porsche911)?.listing.publishedAt).toBeNull();
    expect(listingOf(world, porsche911)?.vehicle.publishedAt).toBeNull();
  });

  it('une date de mise en ligne au 1er mars 2027, plus d’un jour dans le futur, est refusée', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, mustang);

    // When
    const summary = recordPublishedDates(world.dependencies, [
      { site: 'leboncoin', externalId: '2811005678', publishedAt: '2027-03-01T09:00:00+01:00' },
    ]);

    // Then
    expect(summary).toEqual({ received: 1, updated: 0, unknown: 0, skipped: 1 });
    expect(listingOf(world, mustang)?.listing.publishedAt).toBeNull();
  });

  it('une annonce mise en ligne à 1 h 30 à Paris, relevée « 2026-10-16 » quand l’horloge du serveur marque encore le 15 en UTC, est acceptée', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, mustang);
    world.clock.set('2026-10-15T23:30:00.000Z');

    // When
    const summary = recordPublishedDates(world.dependencies, [{ site: 'leboncoin', externalId: '2811005678', publishedAt: '2026-10-16' }]);

    // Then
    expect(summary).toEqual({ received: 1, updated: 1, unknown: 0, skipped: 0 });
    expect(listingOf(world, mustang)?.listing.publishedAt).toBe('2026-10-16T00:00:00.000Z');
  });

  it('un envoi de 1 200 dates n’en traite que les 1 000 premières', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, mustang);
    const others = Array.from(
      { length: PUBLISHED_DATES_LIMIT },
      (_, index): ImportedPublicationDate => ({ site: 'leboncoin', externalId: String(2810000000 + index), publishedAt: '2026-10-10' }),
    );
    const beyondTheLimit = Array.from(
      { length: 200 },
      (): ImportedPublicationDate => ({
        site: 'leboncoin',
        externalId: '2811005678',
        publishedAt: '2026-10-09',
      }),
    );

    // When
    const summary = recordPublishedDates(world.dependencies, [...others, ...beyondTheLimit]);

    // Then
    expect(summary).toEqual({ received: 1000, updated: 0, unknown: 1000, skipped: 0 });
    expect(listingOf(world, mustang)?.listing.publishedAt).toBeNull();
  });

  it('un envoi sans aucune date n’a rien à enregistrer', () => {
    // Given
    const world = ingestWorld();

    // When
    const recording = (): unknown => recordPublishedDates(world.dependencies, []);

    // Then
    expect(recording).toThrow(NoDateToRecord);
  });
});
