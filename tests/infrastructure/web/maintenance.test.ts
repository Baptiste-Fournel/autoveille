import { describe, expect, it } from 'vitest';
import { ingestListing } from '../../../src/application/ingest/ingestListing.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import { signedInApplication } from '../../support/signedInApplication.js';

const RECEIVED_THIS_MORNING: readonly RawListing[] = [
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811005678',
    url: 'https://www.leboncoin.fr/ad/voitures/2811005678',
    title: 'Ford Mustang GT 5.0 V8 Fastback',
    price: 42900,
    km: 31000,
    year: 2018,
    city: 'Arcachon',
    postalCode: '33120',
    sellerType: 'particulier',
  },
  {
    site: 'lacentrale',
    siteLabel: 'La Centrale',
    externalId: '69112345678',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
    title: 'Mercedes-AMG C63 S Coupé',
    price: 64900,
    km: 45200,
    year: 2019,
    city: 'Libourne',
    postalCode: '33500',
    sellerType: 'particulier',
  },
];

describe('maintenance', () => {
  it('la maintenance relit les annonces reçues ce matin avec les règles du jour : rien n’a changé, le bilan le dit', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const { ports } = application;
    for (const listing of RECEIVED_THIS_MORNING) {
      await ingestListing(ports, { listing, settings: ports.settings.load(), notify: false });
    }

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/maintenance/repair', headers: session });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { vehicles: 2, renamed: 0, split: 0, reevaluated: 0 },
    });
  });
});
