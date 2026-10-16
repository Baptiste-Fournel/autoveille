import { describe, expect, it } from 'vitest';
import type { ImportResponse, VehiclesResponse } from '../../src/shared/api.js';
import { type Phone, setUpDealership } from '../support/dealerPhone.js';
import { PORSCHE_911_ON_LEBONCOIN, porscheGirondeAlert } from '../support/porscheGirondeAlert.js';

const FIRST_911_YEAR = 1965;

const YEARS_OF_911 = 60;

const VERSIONS = ['Carrera', 'Targa'] as const;

const FIVE_MINUTES_MS = 300_000;

const LAST_PUBLICATION = Date.parse('2026-10-15T08:00:00.000Z');

const NEW_ALERT_DURING_THE_SCROLL = porscheGirondeAlert({ uid: 7, receivedAt: '2026-10-15T08:24:51.000Z' });

const porsche911sOfTheWeek = () =>
  VERSIONS.flatMap((version, versionIndex) =>
    Array.from({ length: YEARS_OF_911 }, (_, yearIndex) => {
      const rank = versionIndex * YEARS_OF_911 + yearIndex;
      const externalId = String(2812000000 + rank);
      return {
        site: 'leboncoin',
        siteLabel: 'Leboncoin',
        externalId,
        url: `https://www.leboncoin.fr/ad/voitures/${externalId}`,
        title: `Porsche 911 ${version}`,
        price: 45000 + rank * 500,
        km: 20000 + (rank % 40) * 2000,
        year: FIRST_911_YEAR + yearIndex,
        city: 'Mérignac',
        postalCode: '33700',
        sellerType: 'particulier',
        publishedAt: new Date(LAST_PUBLICATION - rank * FIVE_MINUTES_MS).toISOString(),
      };
    }),
  );

const page = async (phone: Phone, cursor?: string | null): Promise<VehiclesResponse> => {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { body } = await phone.request<VehiclesResponse>('GET', `/api/vehicles${query}`);
  return body;
};

describe('liste des annonces page par page', () => {
  it('120 Porsche 911 à traiter arrivent en pages de 50, 50 puis 20, sans doublon ni oubli, même quand une nouvelle alerte arrive pendant que le concessionnaire fait défiler la liste', async () => {
    // Given
    const { inbox, phone } = await setUpDealership();
    const listings = porsche911sOfTheWeek();
    const imported = await phone.request<ImportResponse>('POST', '/api/import', { listings });

    // When
    const first = await page(phone);
    inbox.receive(NEW_ALERT_DURING_THE_SCROLL);
    await phone.request('POST', '/api/sources/check-now');
    const second = await page(phone, first.nextCursor);
    const third = await page(phone, second.nextCursor);
    const refreshed = await page(phone);

    // Then
    const scrolled = [...first.vehicles, ...second.vehicles, ...third.vehicles].map((vehicle) => vehicle.url);
    expect(imported.body).toEqual({ received: 120, new: 120, matched: 120, seen: 0, skipped: 0 });
    expect([first.vehicles.length, second.vehicles.length, third.vehicles.length]).toEqual([50, 50, 20]);
    expect([typeof first.nextCursor, typeof second.nextCursor, third.nextCursor]).toEqual(['string', 'string', null]);
    expect(new Set(scrolled).size).toBe(120);
    expect(scrolled).toEqual(listings.map((listing) => listing.url));
    expect(refreshed.vehicles[0]?.url).toBe(PORSCHE_911_ON_LEBONCOIN);
  });
});
