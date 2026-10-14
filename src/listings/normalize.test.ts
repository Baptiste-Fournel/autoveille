import { describe, expect, it } from 'vitest';
import { extractVehicleInfo, fingerprint, parseKm, parseLocation, parsePrice, parseYear, similar } from './normalize.js';
import { detectBrand, detectFamily } from './brands.js';
import type { RawListing } from '../types.js';

const raw = (title: string, extra: Partial<RawListing> = {}): RawListing => ({ site: 'test', siteLabel: 'Test', externalId: '1', url: 'https://x/1', title, ...extra });

describe('parsers', () => {
  it('parses prices with French thousands separators', () => {
    expect(parsePrice('Prix 89 900 €')).toBe(89900);
    expect(parsePrice('89900€')).toBe(89900);
    expect(parsePrice('89.900 EUR')).toBe(89900);
    expect(parsePrice('12 500 € 42 000 km')).toBe(12500);
    expect(parsePrice('rien ici')).toBeUndefined();
    expect(parsePrice('Ferrari F430 F1 119 000 €')).toBe(119000);
    expect(parseKm('Ferrari F430 F1 31 000 km')).toBe(31000);
  });

  it('parses kilometres and ignores short distances', () => {
    expect(parseKm('42 000 km')).toBe(42000);
    expect(parseKm('42000km')).toBe(42000);
    expect(parseKm('à 12 km de chez vous, 65 500 kms')).toBe(65500);
  });

  it('parses years, preferring labelled ones', () => {
    expect(parseYear('Porsche 911 2015 42 000 km')).toBe(2015);
    expect(parseYear('Année : 2009, 1ère main')).toBe(2009);
    expect(parseYear('Mercedes 190 Evo 2 1990')).toBe(1990);
    expect(parseYear('BMW 2002 tii 1973')).toBe(2002); // ambiguous, first standalone year wins
    expect(parseYear('prix 2000 €')).toBeUndefined();
  });

  it('parses locations', () => {
    expect(parseLocation('Mérignac 33700')).toEqual({ city: 'Mérignac', postalCode: '33700' });
    expect(parseLocation('33700 Mérignac')).toEqual({ city: 'Mérignac', postalCode: '33700' });
    expect(parseLocation('Bordeaux (33)')).toEqual({ city: 'Bordeaux', postalCode: '33000' });
    expect(parseLocation('Saint-Médard-en-Jalles (33)').city).toBe('Saint-Médard-En-Jalles');
  });
});

describe('brands and families', () => {
  it('detects brands with aliases, longest first', () => {
    expect(detectBrand('Mercedes AMG GT 63 S')?.make).toBe('Mercedes-Benz');
    expect(detectBrand('Alfa Romeo 4C')?.make).toBe('Alfa Romeo');
    expect(detectBrand('Dodge RAM 1500')?.make).toBe('RAM');
    expect(detectBrand('VW Golf GTI')?.make).toBe('Volkswagen');
    expect(detectBrand('Citroen DS 21')?.make).toBe('Citroën');
    expect(detectBrand('Renault Clio')).toBeTruthy();
    expect(detectBrand('Toyota Supra')).toMatchObject({ make: 'Toyota', family: 'autres' });
    expect(detectBrand('Zastava Yugo')).toBeUndefined();
  });

  it('only counts American Fords', () => {
    expect(detectFamily('Ford', 'Mustang GT', 'Ford Mustang GT 5.0')).toBe('americaines');
    expect(detectFamily('Ford', 'Fiesta', 'Ford Fiesta 1.0')).toBe('autres');
  });

  it('extracts make, model, year, km and price from a title', () => {
    const info = extractVehicleInfo(raw('Porsche 911 Carrera 4S 3.0 450ch PDK 2017 42 000 km 112 900 €'));
    expect(info).toMatchObject({ make: 'Porsche', model: '911 Carrera 4S', family: 'allemandes', year: 2017, km: 42000, price: 112900 });
  });

  it('keeps source fields when given', () => {
    const info = extractVehicleInfo(raw('BMW M3 Compétition', { year: 2021, km: 18000, price: 79000 }));
    expect(info).toMatchObject({ make: 'BMW', model: 'M3 Compétition', year: 2021, km: 18000, price: 79000 });
  });
});

describe('fingerprint', () => {
  it('matches the same car across sites and reposts, within a km bucket', () => {
    const a = raw('Porsche 911 Carrera S 2015 42 000 km 89 900 €', { postalCode: '33700', site: 'leboncoin' });
    const b = raw('PORSCHE 911 CARRERA S PDK 2015', { km: 43500, price: 88000, postalCode: '33000', site: 'lacentrale', externalId: '9' });
    expect(fingerprint(extractVehicleInfo(a), a)).toBe(fingerprint(extractVehicleInfo(b), b));
  });

  it('separates different years, and far-apart kilometres through similar()', () => {
    const a = raw('Porsche 911 Carrera S 2015 42 000 km', { postalCode: '33700' });
    const b = raw('Porsche 911 Carrera S 2016 42 000 km', { postalCode: '33700' });
    expect(fingerprint(extractVehicleInfo(a), a)).not.toBe(fingerprint(extractVehicleInfo(b), b));
    expect(similar({ km: 42000 }, { km: 43500 })).toBe(true);
    expect(similar({ km: 42000 }, { km: 95000 })).toBe(false);
    expect(similar({ km: 150000 }, { km: 162000 })).toBe(true);
    expect(similar({ km: undefined, price: 89000 }, { km: 42000, price: 86000 })).toBe(true);
    expect(similar({ price: 89000 }, { price: 60000 })).toBe(false);
  });

  it('does not merge two cars of the same model whose prices disagree, even with close kilometres', () => {
    expect(similar({ km: 45000, price: 54000 }, { km: 46000, price: 61900 })).toBe(true); // 14.6 %: a repost with a new price
    expect(similar({ km: 45000, price: 54000 }, { km: 46000, price: 70000 })).toBe(false);
    expect(similar({ km: 1, price: 2800 }, { km: 999, price: 200 })).toBe(false);
  });

  it('reads the model from the seller’s words when the site only gives a placeholder', () => {
    expect(extractVehicleInfo(raw('Ford Autres - Ford ranger raptor'))).toMatchObject({ make: 'Ford', model: 'ranger raptor' });
    expect(extractVehicleInfo(raw('Peugeot Autres - Peugeot 203'))).toMatchObject({ make: 'Peugeot', model: '203' });
    expect(extractVehicleInfo(raw('Citroen Autres - Vente de Citroën DS 5 super'))).toMatchObject({ make: 'Citroën', model: 'DS 5 super' });
    expect(extractVehicleInfo(raw('Renault Autres - Renault 4cv cabriolet'))).toMatchObject({ make: 'Renault', model: '4cv cabriolet' });
    expect(extractVehicleInfo(raw('Ford Ranger RANGER DOUBLE CABINE 3.2 TDCi'))).toMatchObject({ make: 'Ford', model: 'Ranger DOUBLE CABINE' });
    const a = raw('Ford Autres - Ford ranger raptor', { postalCode: '33000' });
    const b = raw('Ford Autres - Ford Mustang GT', { postalCode: '33000' });
    expect(fingerprint(extractVehicleInfo(a), a)).not.toBe(fingerprint(extractVehicleInfo(b), b));
  });
});

describe('price written with the currency first (AutoScout24)', () => {
  it('reads "€ 35 500" and does not swallow the kilometres that follow', () => {
    expect(parsePrice('€ 35 500 24 800 km, 10/2020')).toBe(35500);
    expect(parsePrice('€ 2 000 100 000 km, 10/2015')).toBe(2000);
    expect(parsePrice('€ 1 200 000 100 000 km')).toBe(1200000);
    expect(parsePrice('€35500')).toBe(35500);
    expect(parsePrice('EUR 12 900')).toBe(12900);
  });
});

describe('other brands', () => {
  it('names the make of a car outside the four families, and lets a person move it into one', () => {
    expect(extractVehicleInfo({ site: 's', siteLabel: 'S', externalId: '1', url: 'u', title: 'Mazda 5 2.0 CD-MZR 143 7pl Elegance' })).toMatchObject({ make: 'Mazda', model: '5', family: 'autres' });
    const moved = extractVehicleInfo({ site: 's', siteLabel: 'S', externalId: '1', url: 'u', title: 'Toyota Supra 3.0' }, [{ name: 'Toyota', family: 'allemandes' }]);
    expect(moved).toMatchObject({ make: 'Toyota', family: 'allemandes' });
  });
});

describe('placeholder models, edge cases', () => {
  it('reads the words after the placeholder even when the brand is not repeated first', () => {
    expect(extractVehicleInfo({ site: 's', siteLabel: 's', externalId: '1', url: 'https://x/1', title: 'Citroen Autres - Acadiane Citroen' })).toMatchObject({ make: 'Citroën', model: 'Acadiane Citroen' });
    expect(extractVehicleInfo({ site: 's', siteLabel: 's', externalId: '1', url: 'https://x/1', title: 'Renault Autres - Renault 1929' }).model).toBeUndefined();
  });
});
