import { describe, expect, it, onTestFinished } from 'vitest';
import { ingestListing } from '../../src/application/ingest/ingestListing.js';
import type { RawListing } from '../../src/domain/vehicle/types.js';
import { type ComposedApplication, composedApplication } from '../support/composedApplication.js';

const PORSCHE_944_SEEN_LAST_WEEK: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2810004321',
  url: 'https://www.leboncoin.fr/ad/voitures/2810004321',
  title: 'Porsche 944 Turbo 2.5 220ch',
  price: 32900,
  km: 96000,
  year: 1986,
  city: 'Saint-Médard-en-Jalles',
  postalCode: '33160',
  sellerType: 'particulier',
};

async function demoApplication(): Promise<ComposedApplication> {
  const application = await composedApplication({ environment: { DEMO: '1' } });
  onTestFinished(() => application.stop());
  return application;
}

describe('données de démonstration (DEMO=1)', () => {
  it('au premier démarrage avec DEMO=1, la base vide reçoit les dix annonces d’exemple, la baisse de prix de la Porsche, la Mercedes republiée et l’Alpine contactée', async () => {
    // Given
    const application = await demoApplication();

    // When
    await application.start();

    // Then
    const vehicles = application.ports.vehicles.allVehicles();
    const named = (make: string, model: string) => vehicles.find((vehicle) => vehicle.make === make && vehicle.model === model);
    expect(vehicles).toHaveLength(10);
    expect(named('Porsche', '911 Carrera 4S')).toMatchObject({ price: 109900, priceDropped: true });
    expect(named('Mercedes-Benz', 'C63 S Coupé')).toMatchObject({ reposted: true });
    expect(named('Alpine', 'A110 Légende')).toMatchObject({ status: 'contacte' });
  });

  it('avec DEMO=1, une base qui a déjà reçu une annonce la semaine dernière ne reçoit pas les annonces d’exemple', async () => {
    // Given
    const application = await demoApplication();
    const { ports } = application;
    await ingestListing(ports, {
      listing: PORSCHE_944_SEEN_LAST_WEEK,
      settings: ports.settings.load(),
      notify: false,
      aboutOlderAds: false,
    });
    application.clock.advanceBy(7 * 86_400_000);

    // When
    await application.start();

    // Then
    expect(ports.vehicles.allVehicles().map((vehicle) => vehicle.model)).toEqual(['944 Turbo']);
  });
});
