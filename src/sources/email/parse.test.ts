import { describe, expect, it } from 'vitest';
import { parseAlertEmail } from './parse.js';
import { listingRef, unwrapTrackingUrl } from '../sites.js';

const LBC_HTML = `
<html><body>
<table><tr><td><a href="https://www.leboncoin.fr/recherches/123"><img src="https://img.leboncoin.fr/logo.png" width="120"></a></td></tr></table>
<p>3 nouvelles annonces correspondent à votre recherche « Porsche Gironde »</p>
<table>
  <tr>
    <td><a href="https://www.leboncoin.fr/ad/voitures/2811001234?utm_source=alert"><img src="https://img.leboncoin.fr/api/v1/lbcpb1/images/abc.jpg" width="200" alt="Porsche 911"></a></td>
    <td>
      <a href="https://www.leboncoin.fr/ad/voitures/2811001234?utm_source=alert"><b>Porsche 911 Carrera 4S 3.0 450ch PDK</b></a><br>
      <span>89 900 €</span><br>
      <span>2017 · 42 000 km · Essence · Automatique</span><br>
      <span>Mérignac 33700</span> <span>Particulier</span><br>
      <a href="https://www.leboncoin.fr/ad/voitures/2811001234?utm_source=alert">Voir l'annonce</a>
    </td>
  </tr>
  <tr>
    <td><a href="https://www.leboncoin.fr/ad/voitures/2811005678"><img src="https://img.leboncoin.fr/api/v1/lbcpb1/images/def.jpg" width="200"></a></td>
    <td>
      <a href="https://www.leboncoin.fr/ad/voitures/2811005678"><b>Audi RS6 Avant 4.0 TFSI 600ch</b></a><br>
      <span>112 000 €</span><br>
      <span>2020 · 38 500 km · Essence</span><br>
      <span>Bordeaux 33000</span> <span>Pro</span>
    </td>
  </tr>
  <tr>
    <td></td>
    <td>
      <a href="https://www.leboncoin.fr/ad/voitures/2811009999">BMW M3 E46 3.2 343ch</a><br>
      <span>Année : 2004</span> <span>Kilométrage : 128 000 km</span> <span>Prix : 34 500 €</span><br>
      <span>Pessac (33)</span>
    </td>
  </tr>
</table>
<p><a href="https://www.leboncoin.fr/compte/alertes/unsubscribe?id=1">Se désabonner</a></p>
</body></html>`;

describe('alert email parsing', () => {
  it('extracts one listing per ad block from a table layout', () => {
    const out = parseAlertEmail({ html: LBC_HTML, from: 'alerte@leboncoin.fr', date: new Date('2026-10-14T08:00:00Z'), messageId: '<m1>' });
    expect(out.site).toBe('leboncoin');
    expect(out.listings).toHaveLength(3);
    const [p, a, b] = out.listings;
    expect(p).toMatchObject({ site: 'leboncoin', externalId: '2811001234', title: 'Porsche 911 Carrera 4S 3.0 450ch PDK', price: 89900, km: 42000, year: 2017, city: 'Mérignac', postalCode: '33700', sellerType: 'particulier' });
    expect(p.url).toBe('https://www.leboncoin.fr/ad/voitures/2811001234');
    expect(p.imageUrl).toContain('abc.jpg');
    expect(a).toMatchObject({ externalId: '2811005678', price: 112000, km: 38500, year: 2020, sellerType: 'pro', city: 'Bordeaux' });
    expect(b).toMatchObject({ externalId: '2811009999', title: 'BMW M3 E46 3.2 343ch', year: 2004, km: 128000, price: 34500, city: 'Pessac', postalCode: '33000' });
    expect(out.pending).toHaveLength(0);
  });

  it('keeps tracking links that cannot be unwrapped as pending, and uses them once resolved', () => {
    const html = `<div><a href="https://click.mail.lacentrale.fr/r/abc123?x=1">Mercedes-AMG C63 S Coupé</a><br>
      <span>2019</span> <span>45 200 km</span> <span>64 900 €</span><br><span>Libourne (33)</span></div>`;
    const first = parseAlertEmail({ html, from: 'alertes@info.lacentrale.fr' });
    expect(first.listings).toHaveLength(0);
    expect(first.pending).toEqual([{ href: 'https://click.mail.lacentrale.fr/r/abc123?x=1', text: 'Mercedes-AMG C63 S Coupé' }]);
    const resolved = new Map([['https://click.mail.lacentrale.fr/r/abc123?x=1', 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html']]);
    const second = parseAlertEmail({ html, from: 'alertes@info.lacentrale.fr' }, resolved);
    expect(second.listings).toHaveLength(1);
    expect(second.listings[0]).toMatchObject({ site: 'lacentrale', externalId: '69112345678', title: 'Mercedes-AMG C63 S Coupé', year: 2019, km: 45200, price: 64900, city: 'Libourne' });
  });

  it('unwraps destinations embedded in tracking urls', () => {
    const u = unwrapTrackingUrl('https://links.notify.example.com/click?u=' + encodeURIComponent('https://www.leboncoin.fr/ad/voitures/555555?utm=1'));
    expect(u).toEqual({ url: 'https://www.leboncoin.fr/ad/voitures/555555?utm=1', resolved: true });
    expect(unwrapTrackingUrl('https://www.paruvendu.fr/a/voiture-occasion/porsche/911/1234567890A1B').resolved).toBe(true);
    expect(unwrapTrackingUrl('https://t.paruvendu.fr/x/y').resolved).toBe(false);
  });

  it('recognises listing urls of known sites and unknown ones generically', () => {
    expect(listingRef('https://www.autoscout24.fr/annonces/porsche-911-carrera-essence-noir-12345678-1234-1234-1234-123456789abc')?.id).toBe('12345678-1234-1234-1234-123456789abc');
    expect(listingRef('https://www.paruvendu.fr/a/voiture-occasion/porsche/911/1234567890A1B')?.id).toBe('1234567890A1B');
    expect(listingRef('https://www.leboncoin.fr/recherches/123')).toBeUndefined();
    const generic = listingRef('https://www.petit-site-auto.fr/annonce/porsche-911-carrera-4s-2015/987654');
    expect(generic).toMatchObject({ site: 'petit-site-auto.fr', siteLabel: 'Petit-site-auto', id: '987654' });
    expect(listingRef('https://www.petit-site-auto.fr/aide/contact/987654')).toBeUndefined();
  });

  it('parses a text-only alert', () => {
    const text = `Nouvelle annonce correspondant à votre alerte

Ferrari 360 Modena F1
2001 - 45 000 km - 79 000 €
Langon (33)
https://www.paruvendu.fr/a/voiture-occasion/ferrari/360/ABCDEF123456

Pour ne plus recevoir ces alertes : https://www.paruvendu.fr/compte/alertes`;
    const out = parseAlertEmail({ text, from: 'alertes@paruvendu.fr' });
    expect(out.listings).toHaveLength(1);
    expect(out.listings[0]).toMatchObject({ site: 'paruvendu', externalId: 'ABCDEF123456', title: 'Ferrari 360 Modena F1', year: 2001, km: 45000, price: 79000, city: 'Langon' });
  });

  it('handles single-ad emails without swallowing the footer', () => {
    const html = `<html><body><table><tr><td>
      <h2><a href="https://www.leboncoin.fr/ad/voitures/2811000001">Alpine A110 Légende 252ch</a></h2>
      <p>58 900 €</p><p>2019 · 21 000 km</p><p>Arcachon 33120</p>
      </td></tr></table>
      <table><tr><td><p>Vous recevez cet email car vous avez créé une alerte. Prix et disponibilité sous réserve. 1 500 € de remise sur l'assurance.</p>
      <a href="https://www.leboncoin.fr/compte/alertes">Gérer mes alertes</a></td></tr></table></body></html>`;
    const out = parseAlertEmail({ html, from: 'alerte@leboncoin.fr' });
    expect(out.listings).toHaveLength(1);
    expect(out.listings[0]).toMatchObject({ title: 'Alpine A110 Légende 252ch', price: 58900, km: 21000, year: 2019, city: 'Arcachon' });
  });
});

/** Layout of the real AutoScout24 "saved search" email (14/10/2026): tracking links, title not linked, price written "€ 35 500". */
const AS24_HTML = `
<html><body>
<p>Meilleures recommandations correspondant à ta nouvelle recherche :</p>
<table><tr>
  <td><div><a href="https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e1" target="_blank"><img src="https://prod.pictures.autoscout24.net/listing-images/8723275b-cdc4-4a58-811d-ae9cef84c6f3_x.jpg/289x217.jpg" alt="AutoScout24 Listing"></a></div></td>
  <td>
    <table><tr><td><div><p><span><strong><span>BMW Z4</span></strong></span></p></div></td></tr></table>
    <table><tr><td><div><p>Z4 sDrive20i 197 ch BVM6</p></div></td></tr></table>
    <table><tr><td><div><p> <span><strong>€ 35 500</strong></span></p></div></td></tr></table>
    <table><tr><td><div><p><span>24 800 km, 10/2020</span></p></div></td></tr></table>
    <table><tr><td><a href="https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e2">Détails</a></td></tr></table>
  </td>
</tr></table>
<table><tr>
  <td><div><a href="https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e3" target="_blank"><img src="https://prod.pictures.autoscout24.net/listing-images/47b79f2f-x.jpg/289x217.jpg" alt="AutoScout24 Listing"></a></div></td>
  <td>
    <table><tr><td><div><p><span><strong><span>Peugeot 108</span></strong></span></p></div></td></tr></table>
    <table><tr><td><div><p>108 1.0 VTi 68ch BVM5 Active</p></div></td></tr></table>
    <table><tr><td><div><p> <span><strong>€ 2 000</strong></span></p></div></td></tr></table>
    <table><tr><td><div><p><span>100 000 km, 10/2015</span></p></div></td></tr></table>
    <table><tr><td><a href="https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e4">Détails</a></td></tr></table>
  </td>
</tr></table>
<table><tr><td>
  <a href="https://links.autoscout24.com/u/click?_t=t1&_m=m1&_e=e5">AutoScout24 - iOS</a>
  <a href="https://links.autoscout24.com/u/click?_t=t1&_m=m1&_e=e6">AutoScout24 - Android</a>
  <p>AutoScout24 France 88 ter, avenue du Général Leclerc | 92100 Boulogne-Billancourt | France</p>
</td></tr></table>
</body></html>`;

describe('AutoScout24 saved-search email', () => {
  const resolved = new Map([
    ['https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e1', 'https://www.autoscout24.fr/offres/bmw-z4-z4-sdrive20i-197-ch-bvm6-essence-gris-cat_ma13mo18308-8723275b-cdc4-4a58-811d-ae9cef84c6f3?cldtidx=0&ap_tier=t30'],
    ['https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e2', 'https://www.autoscout24.fr/offres/bmw-z4-z4-sdrive20i-197-ch-bvm6-essence-gris-cat_ma13mo18308-8723275b-cdc4-4a58-811d-ae9cef84c6f3?cldtidx=0&ap_tier=t30'],
    ['https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e3', 'https://www.autoscout24.fr/offres/peugeot-108-108-1-0-vti-68ch-bvm5-active-essence-gris-cat_ma55mo20374-47b79f2f-3a0d-4c3b-886a-af09f763c39b?cldtidx=1'],
    ['https://links.autoscout24.com/a/click?_t=t1&_m=m1&_e=e4', 'https://www.autoscout24.fr/offres/peugeot-108-108-1-0-vti-68ch-bvm5-active-essence-gris-cat_ma55mo20374-47b79f2f-3a0d-4c3b-886a-af09f763c39b?cldtidx=1'],
    ['https://links.autoscout24.com/u/click?_t=t1&_m=m1&_e=e5', 'https://apps.apple.com/us/app/autoscout24-buying-leasing/id311785642?pt=229724'],
    ['https://links.autoscout24.com/u/click?_t=t1&_m=m1&_e=e6', 'https://play.google.com/store/apps/details?id=com.autoscout24'],
  ]);

  it('reads the price written with the euro sign first, the km, the year and the photo', () => {
    const out = parseAlertEmail({ html: AS24_HTML, from: 'savedsearches@notifications.autoscout24.com' }, resolved);
    expect(out.site).toBe('autoscout24');
    expect(out.listings.map((l) => l.title)).toEqual(['BMW Z4', 'Peugeot 108']);
    const [z4, p108] = out.listings;
    expect(z4).toMatchObject({ site: 'autoscout24', price: 35500, km: 24800, year: 2020 });
    expect(z4.imageUrl).toContain('8723275b');
    expect(z4.url).toContain('/offres/bmw-z4');
    expect(p108).toMatchObject({ price: 2000, km: 100000, year: 2015 });
  });

  it('ignores the App Store and Play Store links of the footer', () => {
    const out = parseAlertEmail({ html: AS24_HTML, from: 'savedsearches@notifications.autoscout24.com' }, resolved);
    expect(out.listings.some((l) => /apple|google/.test(l.url))).toBe(false);
  });
});
