import { describe, expect, it } from 'vitest';
import type { CheckNowResponse, ImportResponse, RereadResponse, SourcesResponse, VehicleDto } from '../../src/shared/api.js';
import { setUpDealership } from '../support/dealerPhone.js';
import { loadFixture } from '../support/fixtures.js';
import type { StoredImapMessage } from '../support/simulatedImapClient.js';

const PARUVENDU_ALERT: StoredImapMessage = {
  uid: 12,
  receivedAt: '2026-10-15T06:05:12.000Z',
  source: loadFixture('emails/paruvendu/une-nouvelle-annonce.eml'),
};

const AUDI_TT_FROM_THE_RESULTS_PAGE = {
  site: 'paruvendu',
  siteLabel: 'ParuVendu',
  externalId: '1296277822A1KVVOAUTT',
  url: 'https://www.paruvendu.fr/a/voiture-occasion/audi/tt/1296277822A1KVVOAUTT',
  title: 'Audi Tt éthanol',
  price: 17000,
  km: 75000,
  year: 2011,
};

const emailsOnTheSitesScreen = (sources: SourcesResponse) =>
  sources.emails.map((email) => [email.message_id, email.parsed_count, email.error]);

describe('relecture de la boîte', () => {
  it('« Tout relire » relit l’alerte ParuVendu dont Gmail avait coupé la lecture : l’Audi TT importée sans photo reçoit sa photo, sans seconde voiture ni seconde annonce', async () => {
    // Given
    const { application, inbox, phone } = await setUpDealership();
    const imported = await phone.request<ImportResponse>('POST', '/api/import', { listings: [AUDI_TT_FROM_THE_RESULTS_PAGE] });
    inbox.receive(PARUVENDU_ALERT);
    inbox.cutOffWhileReading(PARUVENDU_ALERT.uid);
    const cutOff = await phone.request<CheckNowResponse>('POST', '/api/sources/check-now');
    const nothingNew = await phone.request<CheckNowResponse>('POST', '/api/sources/check-now');
    const { body: sourcesBefore } = await phone.request<SourcesResponse>('GET', '/api/sources');
    const audiId = application.ports.vehicles.findListing('paruvendu', AUDI_TT_FROM_THE_RESULTS_PAGE.externalId)?.vehicle.id;
    const { body: beforeRereading } = await phone.request<VehicleDto>('GET', `/api/vehicles/${audiId}`);

    // When
    const reread = await phone.request<RereadResponse>('POST', '/api/sources/reread');

    // Then
    const { body: afterRereading } = await phone.request<VehicleDto>('GET', `/api/vehicles/${audiId}`);
    const { body: sourcesAfter } = await phone.request<SourcesResponse>('GET', '/api/sources');
    expect(imported.body).toMatchObject({ received: 1, new: 1 });
    expect(cutOff.body.mail.detail).toBe(
      '0 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 12: Unexpected close',
    );
    expect(nothingNew.body.mail.detail).toBe('0 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages');
    expect(emailsOnTheSitesScreen(sourcesBefore)).toEqual([['uid-1-12', 0, 'Unexpected close']]);
    expect(beforeRereading.imageUrl).toBeNull();
    expect(reread.body.mail).toEqual({
      source: 'email',
      ok: true,
      detail: '1 email(s) lu(s), 1 annonce(s), 0 nouvelle(s) correspondant aux réglages',
    });
    expect(afterRereading.imageUrl).toMatch(/^https:\/\/media\.paruvendu\.fr\//);
    expect(afterRereading.listings.map((listing) => listing.url)).toEqual([AUDI_TT_FROM_THE_RESULTS_PAGE.url]);
    expect(application.ports.vehicles.allVehicles().map((vehicle) => vehicle.id)).toEqual([audiId]);
    expect(emailsOnTheSitesScreen(sourcesAfter)).toEqual([['<alerte-une-nouvelle-annonce@paruvendu.fr>', 1, null]]);
  });
});
