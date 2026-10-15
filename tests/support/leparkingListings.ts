import type { RawListing } from '../../src/domain/vehicle/types.js';

export const LEPARKING_BMW_M3_SEARCH = 'https://www.leparking.fr/voiture-occasion/bmw-m3.html';

const leparkingListing = (id: string, slug: string, fields: Omit<RawListing, 'site' | 'siteLabel' | 'externalId' | 'url'>): RawListing => ({
  site: 'leparking',
  siteLabel: 'Leparking',
  externalId: id,
  url: `https://www.leparking.fr/voiture-occasion/${slug}-${id}.html`,
  ...fields,
});

export const LEPARKING_BMW_M3_RESULTS: readonly RawListing[] = [
  leparkingListing('4417052', 'bmw-m3-competition', {
    title: 'BMW M3 Compétition',
    price: 72900,
    km: 38000,
    year: 2018,
    city: 'Bordeaux',
    postalCode: '33000',
  }),
  leparkingListing('4417318', 'bmw-m3-e46', { title: 'BMW M3 E46 343ch SMG', price: 34900, km: 142000, year: 2003, city: 'Mérignac' }),
  leparkingListing('4418240', 'bmw-m3-e92', { title: 'BMW M3 E92 4.0 V8 420ch DKG', price: 41500, km: 98000, year: 2009 }),
  leparkingListing('4419001', 'bmw-m3-e36', { title: 'BMW M3 E36 3.2 321ch', price: 28900, km: 176000, year: 1998, city: 'Libourne' }),
  leparkingListing('4419577', 'bmw-m3-cs', { title: 'BMW M3 CS 460ch', price: 99000, km: 21000, year: 2018, city: 'Arcachon' }),
  leparkingListing('4420113', 'bmw-m3-e30', { title: 'BMW M3 E30 2.3 195ch', price: 79000, km: 112000, year: 1988, city: 'Pessac' }),
];
