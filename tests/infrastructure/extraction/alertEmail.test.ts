import { describe, expect, it } from 'vitest';
import { parseAlertEmail } from '../../../src/sources/email/parse.js';
import { loadFixture } from '../../support/fixtures.js';
import { laCentraleDigestLinksResolvedOverHttp } from '../../support/laCentraleClickTracker.js';

const AUTOSCOUT24_SAVED_SEARCH = loadFixture('emails/autoscout24/recherche-sauvegardee-deux-annonces-et-liens-app-store.html');

const AUTOSCOUT24_LINKS_RESOLVED_OVER_HTTP = new Map([
  [
    'https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e1',
    'https://www.autoscout24.fr/offres/bmw-z4-z4-sdrive20i-197-ch-bvm6-essence-gris-cat_ma13mo18308-8723275b-cdc4-4a58-811d-ae9cef84c6f3?cldtidx=0&ap_tier=t30',
  ],
  [
    'https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e2',
    'https://www.autoscout24.fr/offres/bmw-z4-z4-sdrive20i-197-ch-bvm6-essence-gris-cat_ma13mo18308-8723275b-cdc4-4a58-811d-ae9cef84c6f3?cldtidx=0&ap_tier=t30',
  ],
  [
    'https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e3',
    'https://www.autoscout24.fr/offres/peugeot-108-108-1-0-vti-68ch-bvm5-active-essence-gris-cat_ma55mo20374-47b79f2f-3a0d-4c3b-886a-af09f763c39b?cldtidx=1',
  ],
  [
    'https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e4',
    'https://www.autoscout24.fr/offres/peugeot-108-108-1-0-vti-68ch-bvm5-active-essence-gris-cat_ma55mo20374-47b79f2f-3a0d-4c3b-886a-af09f763c39b?cldtidx=1',
  ],
  [
    'https://links.autoscout24.com/u/click?_t=t1&_m=m1&_e=e5',
    'https://apps.apple.com/us/app/autoscout24-buying-leasing/id311785642?pt=229724',
  ],
  ['https://links.autoscout24.com/u/click?_t=t1&_m=m1&_e=e6', 'https://play.google.com/store/apps/details?id=com.autoscout24'],
]);

describe('lecture des emails d’alerte', () => {
  it('un email Leboncoin de trois annonces en tableau donne trois annonces complètes', () => {
    // Given
    const html = loadFixture('emails/leboncoin/trois-annonces-en-tableau.html');

    // When
    const out = parseAlertEmail({ html, from: 'alerte@leboncoin.fr', date: new Date('2026-10-14T08:00:00Z'), messageId: '<m1>' });

    // Then
    expect(out.site).toBe('leboncoin');
    expect(out.listings).toHaveLength(3);
    const [porsche, second, bmw] = out.listings;
    expect(porsche).toMatchObject({
      site: 'leboncoin',
      externalId: '2811001234',
      title: 'Porsche 911 Carrera 4S 3.0 450ch PDK',
      price: 89900,
      km: 42000,
      year: 2017,
      city: 'Mérignac',
      postalCode: '33700',
      sellerType: 'particulier',
    });
    expect(porsche?.url).toBe('https://www.leboncoin.fr/ad/voitures/2811001234');
    expect(porsche?.imageUrl).toContain('abc.jpg');
    expect(second).toMatchObject({ externalId: '2811005678', price: 112000, km: 38500, year: 2020, sellerType: 'pro', city: 'Bordeaux' });
    expect(bmw).toMatchObject({
      externalId: '2811009999',
      title: 'BMW M3 E46 3.2 343ch',
      year: 2004,
      km: 128000,
      price: 34500,
      city: 'Pessac',
      postalCode: '33000',
    });
    expect(out.pending).toHaveLength(0);
  });

  it("un email La Centrale dont le lien de suivi ne se déroule qu'en HTTP : l'annonce attend, puis est lue une fois le lien résolu", () => {
    // Given
    const html = loadFixture('emails/lacentrale/annonce-derriere-un-lien-de-suivi.html');
    const resolved = new Map([
      ['https://click.mail.lacentrale.fr/r/abc123?x=1', 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html'],
    ]);

    // When
    const first = parseAlertEmail({ html, from: 'alertes@info.lacentrale.fr' });
    const second = parseAlertEmail({ html, from: 'alertes@info.lacentrale.fr' }, resolved);

    // Then
    expect(first.listings).toHaveLength(0);
    expect(first.pending).toEqual([{ href: 'https://click.mail.lacentrale.fr/r/abc123?x=1', text: 'Mercedes-AMG C63 S Coupé' }]);
    expect(second.listings).toHaveLength(1);
    expect(second.listings[0]).toMatchObject({
      site: 'lacentrale',
      externalId: '69112345678',
      title: 'Mercedes-AMG C63 S Coupé',
      year: 2019,
      km: 45200,
      price: 64900,
      city: 'Libourne',
    });
  });

  it('une alerte ParuVendu en texte seul', () => {
    // Given
    const text = loadFixture('emails/paruvendu/une-annonce-en-texte-seul.txt');

    // When
    const out = parseAlertEmail({ text, from: 'alertes@paruvendu.fr' });

    // Then
    expect(out.listings).toHaveLength(1);
    expect(out.listings[0]).toMatchObject({
      site: 'paruvendu',
      externalId: 'ABCDEF123456',
      title: 'Ferrari 360 Modena F1',
      year: 2001,
      km: 45000,
      price: 79000,
      city: 'Langon',
    });
  });

  it("un email Leboncoin d'une seule annonce dont le pied de page parle de « 1 500 € de remise »", () => {
    // Given
    const html = loadFixture('emails/leboncoin/une-annonce-et-un-pied-de-page-avec-un-prix.html');

    // When
    const out = parseAlertEmail({ html, from: 'alerte@leboncoin.fr' });

    // Then
    expect(out.listings).toHaveLength(1);
    expect(out.listings[0]).toMatchObject({ title: 'Alpine A110 Légende 252ch', price: 58900, km: 21000, year: 2019, city: 'Arcachon' });
  });

  it("l'email AutoScout24 « recherche sauvegardée » : prix « € 35 500 », kilométrage et année des deux annonces, et la photo de la Z4", () => {
    // Given
    const email = { html: AUTOSCOUT24_SAVED_SEARCH, from: 'savedsearches@notifications.autoscout24.com' };

    // When
    const out = parseAlertEmail(email, AUTOSCOUT24_LINKS_RESOLVED_OVER_HTTP);

    // Then
    expect(out.site).toBe('autoscout24');
    expect(out.listings.map((listing) => listing.title)).toEqual(['BMW Z4', 'Peugeot 108']);
    const [z4, peugeot108] = out.listings;
    expect(z4).toMatchObject({ site: 'autoscout24', price: 35500, km: 24800, year: 2020 });
    expect(z4?.imageUrl).toContain('8723275b');
    expect(z4?.url).toContain('/offres/bmw-z4');
    expect(peugeot108).toMatchObject({ price: 2000, km: 100000, year: 2015 });
  });

  it("les liens App Store et Play Store du pied d'un email AutoScout24 ne sont pas des annonces", () => {
    // Given
    const email = { html: AUTOSCOUT24_SAVED_SEARCH, from: 'savedsearches@notifications.autoscout24.com' };

    // When
    const out = parseAlertEmail(email, AUTOSCOUT24_LINKS_RESOLVED_OVER_HTTP);

    // Then
    expect(out.listings.some((listing) => /apple|google/.test(listing.url))).toBe(false);
  });

  it("un vrai email ParuVendu : le titre est celui de l'annonce, pas la ligne de caractéristiques", () => {
    // Given
    const html = loadFixture('emails/paruvendu/une-nouvelle-annonce.html');

    // When
    const out = parseAlertEmail({
      html,
      from: 'info@paruvendu.fr',
      subject: '🚗 1 nouvelle annonce',
      date: new Date('2026-10-15T06:05:12Z'),
    });

    // Then
    expect(out.listings).toHaveLength(1);
    const [audi] = out.listings;
    expect(audi?.site).toBe('paruvendu');
    expect(audi?.externalId).toBe('1296277822A1KVVOAUTT');
    expect(audi?.title).toBe('Audi Tt éthanol');
    expect(audi).toMatchObject({ price: 17000, km: 75000, year: 2011 });
    expect(audi?.url).not.toMatch(/ticket=|mailUniqId/);
    expect(audi?.imageUrl).toMatch(/^https:\/\/media\.paruvendu\.fr\//);
  });

  it("un vrai email La Centrale « 61 nouveaux véhicules » n'en montre que trois : trois annonces avec leur photo, l'écart et le lien vers la suite", () => {
    // Given
    const email = {
      html: loadFixture('emails/lacentrale/61-nouvelles-annonces-dont-3-en-apercu.html'),
      from: 'info@mail-alerte.lacentrale.fr',
      subject: '61 nouveaux véhicules correspondent à votre recherche',
      date: new Date('2026-10-15T06:36:59Z'),
    };

    // When
    const beforeResolution = parseAlertEmail(email);
    const out = parseAlertEmail(email, new Map(laCentraleDigestLinksResolvedOverHttp()));

    // Then
    expect(beforeResolution.listings).toHaveLength(0);
    expect(beforeResolution.pending.length).toBeGreaterThan(30);
    expect(out.kind).toBe('new');
    expect(out.announced).toBe(61);
    expect(out.moreUrl).toBe('https://www.lacentrale.fr/listing?customerFamilyCodes=PART');
    expect(out.listings.map((listing) => listing.title)).toEqual([
      'VOLKSWAGEN COCCINELLE',
      'OPEL MERIVA II phase 2',
      'LAND ROVER DISCOVERY SPORT',
    ]);
    expect(out.listings[0]).toMatchObject({ price: 10500, km: 92000, sellerType: 'particulier', postalCode: '33', city: 'Gironde (33)' });
    expect(out.listings[2]).toMatchObject({ price: 14500, km: 120000 });
    expect(out.listings.map((listing) => listing.imageUrl)).toEqual([
      expect.stringMatching(/^https:\/\/pictures\.lacentrale\.fr\/classifieds\/B104314094_/),
      expect.stringMatching(/^https:\/\/pictures\.lacentrale\.fr\/classifieds\/B104315440_/),
      expect.stringMatching(/^https:\/\/pictures\.lacentrale\.fr\/classifieds\/B104315417_/),
    ]);
  });

  it("un email La Centrale de baisses de prix : pas de date de publication, et l'illustration commune n'est pas une photo", () => {
    // Given
    const email = {
      html: loadFixture('emails/lacentrale/baisses-de-prix-avec-une-illustration-a-la-place-des-photos.html'),
      from: 'info@mail-alerte.lacentrale.fr',
      subject: '↘️ 108 baisses de prix sur votre alerte',
      date: new Date('2026-10-15T10:37:21Z'),
    };

    // When
    const out = parseAlertEmail(email);

    // Then
    expect(out.listings).toHaveLength(2);
    expect(out.listings[0]).toMatchObject({ title: 'RENAULT KOLEOS', price: 14700, km: 131000 });
    expect(out.listings.every((listing) => listing.publishedAt === undefined)).toBe(true);
    expect(out.listings.every((listing) => listing.imageUrl === undefined)).toBe(true);
  });

  it('un email La Centrale de nouvelles annonces donne sa date comme date de publication, et la photo de chaque annonce', () => {
    // Given
    const email = {
      html: loadFixture('emails/lacentrale/deux-annonces-avec-une-photo-par-voiture.html'),
      from: 'info@mail-alerte.lacentrale.fr',
      subject: '2 nouveaux véhicules correspondent à votre recherche',
      date: new Date('2026-10-15T10:37:21Z'),
    };

    // When
    const fresh = parseAlertEmail(email);

    // Then
    expect(fresh.listings.map((listing) => listing.imageUrl)).toEqual([
      'https://pictures.lacentrale.fr/classifieds/A_STANDARD_0.jpg',
      'https://pictures.lacentrale.fr/classifieds/B_STANDARD_0.jpg',
    ]);
    expect(fresh.listings[0]?.publishedAt).toBe('2026-10-15T10:37:21.000Z');
  });

  it("une même image sur deux annonces d'un petit site inconnu n'est la photo d'aucune", () => {
    // Given
    const html = loadFixture('emails/petit-site-auto/deux-annonces-avec-la-meme-image-par-defaut.html');

    // When
    const out = parseAlertEmail({ html, from: 'alertes@petit-site-auto.fr', subject: '2 nouvelles annonces' });

    // Then
    expect(out.listings).toHaveLength(2);
    expect(out.listings.every((listing) => listing.imageUrl === undefined)).toBe(true);
  });
});
