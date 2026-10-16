import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cheerioListingExtractor } from '../../../src/infrastructure/extraction/cheerioListingExtractor.js';
import { fakeClock } from '../../fakes/fakeClock.js';
import { fixturePath, loadFixture } from '../../support/fixtures.js';

const extractor = cheerioListingExtractor(fakeClock());

const rawEmail = (pathInFixtures: string): Uint8Array => new Uint8Array(readFileSync(fixturePath(pathInFixtures)));

describe('lecture d’un email tel que la boîte le rend', () => {
  it('le vrai email ParuVendu téléchargé depuis Gmail (.eml en quoted-printable) : expéditeur, sujet à émoji, date et identifiant décodés, puis l’Audi TT lue dans son corps', async () => {
    // Given
    const source = rawEmail('emails/paruvendu/une-nouvelle-annonce.eml');

    // When
    const email = await extractor.readEmail(source);
    const reading = extractor.listingsFromEmail({ ...email, messageId: email.messageId ?? '' }, new Map());

    // Then
    expect(email).toMatchObject({
      messageId: '<alerte-une-nouvelle-annonce@paruvendu.fr>',
      from: 'info@paruvendu.fr',
      subject: '🚗 1 nouvelle annonce',
      date: '2026-10-15T06:05:12.000Z',
    });
    expect(email.html?.trimEnd()).toBe(loadFixture('emails/paruvendu/une-nouvelle-annonce.html').trimEnd());
    expect(
      reading.listings.map(({ externalId, title, price, km, year, sourceRef }) => ({ externalId, title, price, km, year, sourceRef })),
    ).toEqual([
      {
        externalId: '1296277822A1KVVOAUTT',
        title: 'Audi Tt éthanol',
        price: 17000,
        km: 75000,
        year: 2011,
        sourceRef: '<alerte-une-nouvelle-annonce@paruvendu.fr>',
      },
    ]);
  });

  it('une alerte ParuVendu en texte seul, sans Message-ID : l’identifiant reste absent pour que la lecture de la boîte en fabrique un, et la Ferrari est lue dans le texte', async () => {
    // Given
    const source = rawEmail('emails/paruvendu/une-annonce-en-texte-seul-sans-message-id.eml');

    // When
    const email = await extractor.readEmail(source);
    const reading = extractor.listingsFromEmail({ ...email, messageId: 'uid-7-41' }, new Map());

    // Then
    expect(email).toMatchObject({
      from: 'alertes@paruvendu.fr',
      subject: 'Nouvelle annonce correspondant à votre alerte',
      date: '2026-10-14T17:42:05.000Z',
      html: undefined,
    });
    expect(email.messageId).toBeUndefined();
    expect(reading.listings.map((listing) => listing.title)).toEqual(['Ferrari 360 Modena F1']);
  });
});
