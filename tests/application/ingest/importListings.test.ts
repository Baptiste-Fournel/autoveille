import { describe, expect, it } from 'vitest';
import { IMPORT_LIMIT, importListings, NothingToImport } from '../../../src/application/ingest/importListings.js';
import type { Geocoder } from '../../../src/application/ports/geocoder.js';
import type { ImportedListing } from '../../../src/domain/ingest/imports.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import { fakeGeocoder } from '../../fakes/fakeGeocoder.js';
import { type IngestWorld, ingest, ingestWorld } from '../../support/ingestWorld.js';
import { LEBONCOIN_911_TITLE, leboncoinListing } from '../../support/knownVehicle.js';

const caymanFromTheSearchPage: ImportedListing = {
  site: 'leboncoin',
  externalId: '2811012345',
  url: 'https://www.leboncoin.fr/ad/voitures/2811012345',
  title: 'Porsche Cayman GT4 3.8 385ch',
  price: 89900,
  km: 23000,
  year: 2016,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
  publishedAt: '2026-10-12T18:30:00+02:00',
};

const alpineFromTheSearchPage: ImportedListing = {
  site: 'leboncoin',
  url: 'https://www.leboncoin.fr/ad/voitures/2811012399',
  title: 'Alpine A110 Légende 252ch',
  price: 58900,
  km: 21000,
  year: 2019,
  city: 'Langon',
  postalCode: '33210',
  sellerType: 'particulier',
};

const caymanReadByTheMailbox: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811012345',
  url: 'https://www.leboncoin.fr/ad/voitures/2811012345',
  title: 'Porsche Cayman GT4 3.8 385ch',
  price: 89900,
  km: 23000,
  year: 2016,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
};

const importedByHand = (world: IngestWorld, items: readonly ImportedListing[]) =>
  importListings(world.dependencies, { items, notify: false });

const geocoderWhileTheMailboxRecords = (world: IngestWorld, listing: RawListing): Geocoder => {
  const places = fakeGeocoder();
  let mailboxPending = true;
  return {
    locate: async (place) => {
      if (mailboxPending) {
        mailboxPending = false;
        await ingest(world, listing);
      }
      return places.locate(place);
    },
  };
};

describe('import ponctuel d’annonces lues ailleurs', () => {
  it('une page de recherche importée à la main passe par les mêmes filtres sans notifier, et une annonce déjà connue est complétée', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, leboncoinListing(LEBONCOIN_911_TITLE));
    const items: readonly ImportedListing[] = [
      caymanFromTheSearchPage,
      { site: 'leboncoin', url: 'https://www.leboncoin.fr/ad/voitures/2811003344', title: 'Renault Clio 1.2 2016 60 000 km 7 500 €' },
      {
        site: 'leboncoin',
        externalId: '2811001234',
        url: 'https://www.leboncoin.fr/ad/voitures/2811001234',
        title: LEBONCOIN_911_TITLE,
        description: 'Première main, carnet d’entretien Porsche à jour, jamais accidentée.',
      },
    ];

    // When
    const summary = await importedByHand(world, items);

    // Then
    expect(summary).toEqual({ received: 3, new: 2, matched: 1, seen: 1, skipped: 0 });
    expect(world.channel.pushes()).toHaveLength(1);
    expect(world.vehicles.findListing('leboncoin', '2811001234')?.listing.description).toBe(
      'Première main, carnet d’entretien Porsche à jour, jamais accidentée.',
    );
    expect(world.vehicles.allVehicles()).toHaveLength(3);
  });

  it('les annonces sans site, sans adresse web ou sans titre sont comptées à part, sans rien enregistrer', async () => {
    // Given
    const world = ingestWorld();
    const items: readonly ImportedListing[] = [
      { url: 'https://www.leboncoin.fr/ad/voitures/2811012346', title: 'Audi RS4 Avant 2.9 V6 450ch' },
      { site: 'leboncoin', url: 'javascript:void(0)', title: 'Audi RS4 Avant 2.9 V6 450ch' },
      { site: 'leboncoin', url: 'https://www.leboncoin.fr/ad/voitures/2811012347', title: '   ' },
    ];

    // When
    const summary = await importedByHand(world, items);

    // Then
    expect(summary).toEqual({ received: 3, new: 0, matched: 0, seen: 0, skipped: 3 });
    expect(world.vehicles.allVehicles()).toEqual([]);
  });

  it('une page de 600 résultats La Centrale n’est importée que pour ses 500 premières annonces', async () => {
    // Given
    const world = ingestWorld();
    const items = Array.from(
      { length: 600 },
      (_, index): ImportedListing => ({
        site: 'lacentrale',
        url: `https://www.lacentrale.fr/auto-occasion-annonce-${69116000000 + index}.html`,
        title: 'Porsche 911 Carrera S 3.0 420ch PDK',
        price: 89900,
        km: 42000,
        year: 2015,
        city: 'Pessac',
        postalCode: '33600',
      }),
    );

    // When
    const summary = await importedByHand(world, items);

    // Then
    expect(IMPORT_LIMIT).toBe(500);
    expect(summary).toMatchObject({ received: 500, skipped: 0 });
    expect(world.vehicles.findListing('lacentrale', 'https://www.lacentrale.fr/auto-occasion-annonce-69116000499.html')).toBeDefined();
    expect(world.vehicles.findListing('lacentrale', 'https://www.lacentrale.fr/auto-occasion-annonce-69116000500.html')).toBeUndefined();
  });

  it('l’import lancé sur une page où rien n’a été trouvé n’a rien à importer', async () => {
    // Given
    const world = ingestWorld();

    // When
    const importing = importedByHand(world, []);

    // Then
    await expect(importing).rejects.toBeInstanceOf(NothingToImport);
  });

  it('une annonce La Centrale importée sans nom de site ni identifiant prend « La Centrale » et son adresse, sa date de mise en ligne ramenée en UTC', async () => {
    // Given
    const world = ingestWorld();
    const item: ImportedListing = {
      site: 'lacentrale',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69115730010.html',
      title: '  BMW M2 Compétition 3.0 410ch  ',
      price: 52900,
      km: 38000,
      year: 2019,
      city: 'Pessac',
      postalCode: '33600',
      publishedAt: '2026-10-12T18:30:00+02:00',
    };

    // When
    await importedByHand(world, [item]);

    // Then
    const known = world.vehicles.findListing('lacentrale', 'https://www.lacentrale.fr/auto-occasion-annonce-69115730010.html');
    expect(known?.listing).toMatchObject({
      siteLabel: 'La Centrale',
      title: 'BMW M2 Compétition 3.0 410ch',
      price: 52900,
      publishedAt: '2026-10-12T16:30:00.000Z',
    });
  });

  it('une Cayman importée pendant que la boîte mail enregistre la même est comptée à part, sans voiture en double, et l’import continue', async () => {
    // Given
    const world = ingestWorld();
    const dependencies = { ...world.dependencies, geocoder: geocoderWhileTheMailboxRecords(world, caymanReadByTheMailbox) };

    // When
    const summary = await importListings(dependencies, { items: [caymanFromTheSearchPage, alpineFromTheSearchPage], notify: false });

    // Then
    expect(summary).toEqual({ received: 2, new: 1, matched: 1, seen: 0, skipped: 1 });
    expect(world.vehicles.allVehicles().map((vehicle) => vehicle.model)).toEqual(['Cayman GT4', 'A110 Légende']);
  });
});
