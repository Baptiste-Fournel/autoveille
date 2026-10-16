import type { Settings } from '../../domain/settings/types.js';
import { daysBefore } from '../../domain/time/daysBefore.js';
import type { RawListing } from '../../domain/vehicle/types.js';
import { updateVehicle } from '../vehicles/updateVehicle.js';
import { type IngestDependencies, ingestListing } from './ingestListing.js';

const RECENT_DAYS = 30;

const PORSCHE_911_4S: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811001234',
  url: 'https://www.leboncoin.fr/ad/voitures/2811001234',
  title: 'Porsche 911 Carrera 4S 3.0 450ch PDK',
  price: 112900,
  km: 42000,
  year: 2017,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
};

const MERCEDES_C63: RawListing = {
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
};

const ALPINE_A110: RawListing = {
  site: 'autoscout24',
  siteLabel: 'AutoScout24',
  externalId: '12345678-1234-1234-1234-123456789abc',
  url: 'https://www.autoscout24.fr/annonces/alpine-a110-12345678-1234-1234-1234-123456789abc',
  title: 'Alpine A110 Légende 252ch',
  price: 58900,
  km: 21000,
  year: 2019,
  city: 'Pessac',
  postalCode: '33600',
  sellerType: 'particulier',
};

const DEMO_LISTINGS: readonly RawListing[] = [
  PORSCHE_911_4S,
  MERCEDES_C63,
  {
    site: 'paruvendu',
    siteLabel: 'ParuVendu',
    externalId: 'ABCDEF123456',
    url: 'https://www.paruvendu.fr/a/voiture-occasion/ferrari/360/ABCDEF123456',
    title: 'Ferrari 360 Modena F1',
    price: 79000,
    km: 45000,
    year: 2001,
    city: 'Langon',
    postalCode: '33210',
    sellerType: 'particulier',
  },
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811005678',
    url: 'https://www.leboncoin.fr/ad/voitures/2811005678',
    title: 'Ford Mustang GT 5.0 V8 Fastback',
    price: 42000,
    km: 31000,
    year: 2018,
    city: 'Arcachon',
    postalCode: '33120',
    sellerType: 'particulier',
  },
  ALPINE_A110,
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811009999',
    url: 'https://www.leboncoin.fr/ad/voitures/2811009999',
    title: 'BMW M3 E46 3.2 343ch',
    price: 34500,
    km: 128000,
    year: 2004,
    city: 'Bordeaux',
    postalCode: '33000',
    sellerType: 'particulier',
  },
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811007777',
    url: 'https://www.leboncoin.fr/ad/voitures/2811007777',
    title: 'Audi A3 Sportback 2.0 TDI 150',
    price: 21500,
    km: 48000,
    year: 2019,
    city: 'Talence',
    postalCode: '33400',
    sellerType: 'particulier',
  },
  {
    site: 'lacentrale',
    siteLabel: 'La Centrale',
    externalId: '69100000001',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000001.html',
    title: 'Porsche 911 (997) Carrera S 3.8 355ch',
    price: 54900,
    km: 89000,
    year: 2006,
    city: 'Angoulême',
    postalCode: '16000',
    sellerType: 'pro',
  },
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811008888',
    url: 'https://www.leboncoin.fr/ad/voitures/2811008888',
    title: 'Chevrolet Corvette C7 Stingray 6.2 V8',
    price: 59000,
    km: 27000,
    year: 2016,
    city: 'Gradignan',
    postalCode: '33170',
    sellerType: 'particulier',
  },
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811006666',
    url: 'https://www.leboncoin.fr/ad/voitures/2811006666',
    title: 'Peugeot 205 GTI 1.9 130ch',
    price: 24900,
    km: 98000,
    year: 1990,
    city: 'Blanquefort',
    postalCode: '33290',
    sellerType: 'particulier',
  },
];

const PORSCHE_911_4S_PRICE_DROP: RawListing = { ...PORSCHE_911_4S, price: 109900 };

const MERCEDES_C63_REPOSTED: RawListing = {
  ...MERCEDES_C63,
  externalId: '69112345999',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345999.html',
};

export const hasNoRecentVehicle = ({ vehicles, clock }: Pick<IngestDependencies, 'vehicles' | 'clock'>): boolean =>
  vehicles.vehiclesFirstSeenSince(daysBefore(clock.now(), RECENT_DAYS)).length === 0;

const ingestQuietly = async (dependencies: IngestDependencies, settings: Settings, listing: RawListing): Promise<void> => {
  await ingestListing(dependencies, { listing, settings, notify: false, aboutOlderAds: false });
};

export async function seedDemo(dependencies: IngestDependencies): Promise<void> {
  const settings = dependencies.settings.load();
  for (const listing of [...DEMO_LISTINGS, PORSCHE_911_4S_PRICE_DROP, MERCEDES_C63_REPOSTED]) {
    await ingestQuietly(dependencies, settings, listing);
  }
  const alpine = dependencies.vehicles.findListing(ALPINE_A110.site, ALPINE_A110.externalId);
  if (alpine !== undefined) {
    updateVehicle(dependencies, alpine.vehicle.id, { status: 'contacte' });
  }
}
