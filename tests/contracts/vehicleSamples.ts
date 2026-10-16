import type { VehicleRepository } from '../../src/application/ports/vehicleRepository.js';
import { evaluate } from '../../src/domain/filtering/evaluate.js';
import type { LatLon } from '../../src/domain/geo/distance.js';
import { locate, UNKNOWN_LOCATION, type VehicleLocation, zoneCenter } from '../../src/domain/ingest/location.js';
import { extractVehicleInfo } from '../../src/domain/parsing/vehicleInfo.js';
import { customBrandsOf } from '../../src/domain/settings/customBrands.js';
import { defaultSettings } from '../../src/domain/settings/defaults.js';
import { type NewListing, type NewVehicle, newListing, newVehicle } from '../../src/domain/vehicle/changes.js';
import type { RawListing } from '../../src/domain/vehicle/types.js';

const CITY_CENTRES: Readonly<Record<string, LatLon>> = {
  Mérignac: { lat: 44.8386, lon: -0.6436 },
  Libourne: { lat: 44.915, lon: -0.2436 },
  Langon: { lat: 44.5547, lon: -0.2497 },
  Arcachon: { lat: 44.6586, lon: -1.1689 },
  Pessac: { lat: 44.8067, lon: -0.6311 },
  Bordeaux: { lat: 44.8378, lon: -0.5792 },
  Talence: { lat: 44.808, lon: -0.5908 },
  Angoulême: { lat: 45.6484, lon: 0.1562 },
  Gradignan: { lat: 44.7725, lon: -0.6153 },
  Blanquefort: { lat: 44.9103, lon: -0.6364 },
};

const leboncoin = (externalId: string, fields: Omit<RawListing, 'site' | 'siteLabel' | 'externalId' | 'url'>): RawListing => ({
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId,
  url: `https://www.leboncoin.fr/ad/voitures/${externalId}`,
  ...fields,
});

const laCentrale = (externalId: string, fields: Omit<RawListing, 'site' | 'siteLabel' | 'externalId' | 'url'>): RawListing => ({
  site: 'lacentrale',
  siteLabel: 'La Centrale',
  externalId,
  url: `https://www.lacentrale.fr/auto-occasion-annonce-${externalId}.html`,
  ...fields,
});

export const PORSCHE_911_4S = leboncoin('2811001234', {
  title: 'Porsche 911 Carrera 4S 3.0 450ch PDK',
  price: 112900,
  km: 42000,
  year: 2017,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
});

export const MERCEDES_C63 = laCentrale('69112345678', {
  title: 'Mercedes-AMG C63 S Coupé',
  price: 64900,
  km: 45200,
  year: 2019,
  city: 'Libourne',
  postalCode: '33500',
  sellerType: 'particulier',
});

export const MERCEDES_C63_REPOSTED: RawListing = {
  ...MERCEDES_C63,
  externalId: '69112345999',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345999.html',
  price: 62900,
};

export const FERRARI_360: RawListing = {
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
};

export const MUSTANG_GT = leboncoin('2811005678', {
  title: 'Ford Mustang GT 5.0 V8 Fastback',
  price: 42000,
  km: 31000,
  year: 2018,
  city: 'Arcachon',
  postalCode: '33120',
  sellerType: 'particulier',
});

export const ALPINE_A110: RawListing = {
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

export const BMW_M3_E46 = leboncoin('2811009999', {
  title: 'BMW M3 E46 3.2 343ch',
  price: 34500,
  km: 128000,
  year: 2004,
  city: 'Bordeaux',
  postalCode: '33000',
  sellerType: 'particulier',
});

export const AUDI_A3 = leboncoin('2811007777', {
  title: 'Audi A3 Sportback 2.0 TDI 150',
  price: 21500,
  km: 48000,
  year: 2019,
  city: 'Talence',
  postalCode: '33400',
  sellerType: 'particulier',
});

export const PORSCHE_997_PRO = laCentrale('69100000001', {
  title: 'Porsche 911 (997) Carrera S 3.8 355ch',
  price: 54900,
  km: 89000,
  year: 2006,
  city: 'Angoulême',
  postalCode: '16000',
  sellerType: 'pro',
});

export const CORVETTE_C7 = leboncoin('2811008888', {
  title: 'Chevrolet Corvette C7 Stingray 6.2 V8',
  price: 59000,
  km: 27000,
  year: 2016,
  city: 'Gradignan',
  postalCode: '33170',
  sellerType: 'particulier',
});

export const PEUGEOT_205_GTI = leboncoin('2811006666', {
  title: 'Peugeot 205 GTI 1.9 130ch',
  price: 24900,
  km: 98000,
  year: 1990,
  city: 'Blanquefort',
  postalCode: '33290',
  sellerType: 'particulier',
});

export const MAZDA_5 = leboncoin('2811003333', {
  title: 'Mazda 5 2.0 CD-MZR 143 7pl Elegance',
  price: 6900,
  km: 151000,
  year: 2011,
  city: 'Bordeaux',
  postalCode: '33000',
  sellerType: 'particulier',
});

export const TOYOTA_GR_YARIS = leboncoin('2811004444', {
  title: 'Toyota GR Yaris 1.6 261ch',
  price: 38900,
  km: 18000,
  year: 2021,
  city: 'Pessac',
  postalCode: '33600',
  sellerType: 'particulier',
});

export const ARTEGA_GT = leboncoin('2811002211', {
  title: 'Artega GT 2009 28 000 km 42 000 €',
  price: 42000,
  km: 28000,
  year: 2009,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
});

export const FORD_RANGER_RAPTOR = leboncoin('2811002222', {
  title: 'Ford Autres - Ford ranger raptor',
  price: 61900,
  km: 46000,
  year: 2024,
  city: 'Pessac',
  postalCode: '33600',
  sellerType: 'particulier',
});

export const FORD_MUSTANG_MERGED = leboncoin('2811002223', {
  title: 'Ford Autres - Ford Mustang GT',
  price: 54000,
  km: 45000,
  year: 2024,
  city: 'Pessac',
  postalCode: '33600',
  sellerType: 'particulier',
});

export interface Sighting {
  readonly vehicle: NewVehicle;
  readonly listing: NewListing;
}

export interface StoredSighting {
  readonly vehicleId: number;
  readonly listingId: number;
}

const settings = defaultSettings();

const locationOf = (raw: RawListing): VehicleLocation => {
  const centre = zoneCenter(settings.zone);
  const place = raw.city === undefined ? undefined : CITY_CENTRES[raw.city];
  return centre === undefined || place === undefined ? UNKNOWN_LOCATION : locate(centre, place);
};

export const firstSighting = (raw: RawListing, seenAt: string, vehicle: Partial<NewVehicle> = {}): Sighting => {
  const info = extractVehicleInfo(raw, { customBrands: customBrandsOf(settings), currentYear: 2026 });
  const location = locationOf(raw);
  const verdict = evaluate(raw, info, settings, location.distanceKm);
  return {
    vehicle: {
      ...newVehicle(raw, info, location, verdict, {
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
        publishedAt: raw.publishedAt ?? null,
        reposted: false,
      }),
      ...vehicle,
    },
    listing: newListing(raw, seenAt),
  };
};

export const store = (repository: VehicleRepository, sighting: Sighting): StoredSighting => {
  const vehicleId = repository.addVehicle(sighting.vehicle);
  return { vehicleId, listingId: repository.addListing(vehicleId, sighting.listing) };
};

export const storeFirstSighting = (
  repository: VehicleRepository,
  raw: RawListing,
  seenAt: string,
  vehicle: Partial<NewVehicle> = {},
): StoredSighting => store(repository, firstSighting(raw, seenAt, vehicle));
