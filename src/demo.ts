import type { Store } from './db.js';
import type { Pipeline } from './pipeline.js';
import type { RawListing } from './types.js';

/** A handful of realistic listings so the screens are not empty the first time (DEMO=1 or `npm run demo`). */
export const DEMO_LISTINGS: RawListing[] = [
  { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: '2811001234', url: 'https://www.leboncoin.fr/ad/voitures/2811001234', title: 'Porsche 911 Carrera 4S 3.0 450ch PDK', price: 112900, km: 42000, year: 2017, city: 'Mérignac', postalCode: '33700', sellerType: 'particulier' },
  { site: 'lacentrale', siteLabel: 'La Centrale', externalId: '69112345678', url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html', title: 'Mercedes-AMG C63 S Coupé', price: 64900, km: 45200, year: 2019, city: 'Libourne', postalCode: '33500', sellerType: 'particulier' },
  { site: 'paruvendu', siteLabel: 'ParuVendu', externalId: 'ABCDEF123456', url: 'https://www.paruvendu.fr/a/voiture-occasion/ferrari/360/ABCDEF123456', title: 'Ferrari 360 Modena F1', price: 79000, km: 45000, year: 2001, city: 'Langon', postalCode: '33210', sellerType: 'particulier' },
  { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: '2811005678', url: 'https://www.leboncoin.fr/ad/voitures/2811005678', title: 'Ford Mustang GT 5.0 V8 Fastback', price: 42000, km: 31000, year: 2018, city: 'Arcachon', postalCode: '33120', sellerType: 'particulier' },
  { site: 'autoscout24', siteLabel: 'AutoScout24', externalId: '12345678-1234-1234-1234-123456789abc', url: 'https://www.autoscout24.fr/annonces/alpine-a110-12345678-1234-1234-1234-123456789abc', title: 'Alpine A110 Légende 252ch', price: 58900, km: 21000, year: 2019, city: 'Pessac', postalCode: '33600', sellerType: 'particulier' },
  { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: '2811009999', url: 'https://www.leboncoin.fr/ad/voitures/2811009999', title: 'BMW M3 E46 3.2 343ch', price: 34500, km: 128000, year: 2004, city: 'Bordeaux', postalCode: '33000', sellerType: 'particulier' },
  { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: '2811007777', url: 'https://www.leboncoin.fr/ad/voitures/2811007777', title: 'Audi A3 Sportback 2.0 TDI 150', price: 21500, km: 48000, year: 2019, city: 'Talence', postalCode: '33400', sellerType: 'particulier' },
  { site: 'lacentrale', siteLabel: 'La Centrale', externalId: '69100000001', url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000001.html', title: 'Porsche 911 (997) Carrera S 3.8 355ch', price: 54900, km: 89000, year: 2006, city: 'Angoulême', postalCode: '16000', sellerType: 'pro' },
  { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: '2811008888', url: 'https://www.leboncoin.fr/ad/voitures/2811008888', title: 'Chevrolet Corvette C7 Stingray 6.2 V8', price: 59000, km: 27000, year: 2016, city: 'Gradignan', postalCode: '33170', sellerType: 'particulier' },
  { site: 'leboncoin', siteLabel: 'Leboncoin', externalId: '2811006666', url: 'https://www.leboncoin.fr/ad/voitures/2811006666', title: 'Peugeot 205 GTI 1.9 130ch', price: 24900, km: 98000, year: 1990, city: 'Blanquefort', postalCode: '33290', sellerType: 'particulier' },
];

export async function seedDemo(store: Store, pipeline: Pipeline): Promise<void> {
  for (const l of DEMO_LISTINGS) await pipeline.ingest(l);
  // A price drop and a repost, so the badges show up.
  await pipeline.ingest({ ...DEMO_LISTINGS[0], price: 109900 });
  await pipeline.ingest({ ...DEMO_LISTINGS[1], externalId: '69112345999', url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345999.html' });
  const v = store.listVehicles({ status: 'tous' });
  if (v[2]) store.updateVehicle(v[2].id, { status: 'contacte' });
}
