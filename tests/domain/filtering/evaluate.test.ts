import { describe, expect, it } from 'vitest';
import { evaluate, specialReason } from '../../../src/domain/filtering/evaluate.js';
import type { Verdict } from '../../../src/domain/filtering/verdict.js';
import { extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { Settings } from '../../../src/domain/settings/types.js';
import type { RawListing, VehicleInfo } from '../../../src/domain/vehicle/types.js';
import { rawListing } from '../../support/rawListing.js';

const settings: Settings = defaultSettings();

const privateListing = (title: string, fields: Partial<RawListing> = {}): RawListing =>
  rawListing(title, { sellerType: 'particulier', ...fields });

const infoOf = (listing: RawListing): VehicleInfo => extractVehicleInfo(listing, { customBrands: [], currentYear: 2026 });

const verdictOf = (listing: RawListing, rules: Settings = settings, distanceKm: number | null = null): Verdict =>
  evaluate(listing, infoOf(listing), rules, distanceKm);

describe('filtres des annonces', () => {
  it('une Porsche 911 de particulier à 42 000 km et à 12 km de Bordeaux est retenue', () => {
    // Given
    const listing = privateListing('Porsche 911 Carrera S 2015 42 000 km 89 900 €');

    // When
    const verdict = verdictOf(listing, settings, 12);

    // Then
    expect(verdict.pass).toBe(true);
  });

  it('une 911 vendue par un professionnel est écartée quand « Particuliers uniquement » est coché', () => {
    // Given
    const listing = privateListing('Porsche 911 Carrera S 2015 42 000 km 89 900 €', { sellerType: 'pro' });

    // When
    const verdict = verdictOf(listing, settings, 12);

    // Then
    expect(verdict.pass).toBe(false);
    expect(verdict.rejections).toEqual([{ kind: 'professionalSeller' }]);
  });

  it('une 911 à 142 000 km et à 180 km est écartée pour ces deux raisons', () => {
    // Given
    const listing = privateListing('Porsche 911 Carrera S 2015 142 000 km 59 900 €');

    // When
    const verdict = verdictOf(listing, settings, 180);

    // Then
    expect(verdict.pass).toBe(false);
    expect(verdict.rejections).toEqual([
      { kind: 'mileageAbove', km: 142000, maxKm: 100000 },
      { kind: 'outsideRadius', distanceKm: 180, radiusKm: 100 },
    ]);
  });

  it('la règle supercar et collection famille par famille : RS6, 280 SL Pagode, Clio V6, Alpine A110, Ferrari 360 et Mustang gardées ; A3, Clio 1.2, Giulietta et Fiesta écartées', () => {
    // Given
    const pagode = privateListing('Mercedes 280 SL Pagode 1969 85 000 km 95 000 €');
    const passes = (title: string): boolean => verdictOf(privateListing(title)).pass;

    // When
    const audiA3 = verdictOf(privateListing('Audi A3 Sportback 2019 35 000 km 22 000 €'));
    const pagodeReason = specialReason(settings.families.allemandes, infoOf(pagode), pagode);

    // Then
    expect(audiA3.rejections).toContainEqual({ kind: 'notSpecial' });
    expect(passes('Audi RS6 Avant 2019 35 000 km')).toBe(true);
    expect(pagodeReason).toEqual({ kind: 'priceFloor', minPrice: 40000 });
    expect(passes('Renault Clio 1.2 2016 60 000 km 7 500 €')).toBe(false);
    expect(passes('Renault Clio V6 Phase 2 2004 60 000 km')).toBe(true);
    expect(passes('Alpine A110 Légende 2019 20 000 km')).toBe(true);
    expect(passes('Ferrari 360 Modena 2001 45 000 km')).toBe(true);
    expect(passes('Alfa Romeo Giulietta 1.6 JTDm 2014 90 000 km 9 000 €')).toBe(false);
    expect(passes('Ford Mustang GT 5.0 2018 30 000 km 42 000 €')).toBe(true);
    expect(passes('Ford Fiesta 1.0 2018 30 000 km 12 000 €')).toBe(false);
  });

  it('sans « Supercar et collection uniquement », une Audi A3 est retenue', () => {
    // Given
    const everyCar: Settings = { ...settings, specialOnly: false };
    const listing = privateListing('Audi A3 Sportback 2019 35 000 km 22 000 €');

    // When
    const verdict = verdictOf(listing, everyCar);

    // Then
    expect(verdict.pass).toBe(true);
  });

  it('une Audi RS6 est écartée quand Audi est désactivée chez les allemandes', () => {
    // Given
    const germans = settings.families.allemandes;
    const withoutAudi: Settings = {
      ...settings,
      families: { ...settings.families, allemandes: { ...germans, brands: germans.brands.filter((brand) => brand !== 'Audi') } },
    };
    const listing = privateListing('Audi RS6 Avant 2019 35 000 km');

    // When
    const verdict = verdictOf(listing, withoutAudi);

    // Then
    expect(verdict.rejections).toEqual([{ kind: 'disabledBrand', make: 'Audi' }]);
  });

  it("une 911 de 1998 sans kilométrage ni distance connus n'est pas écartée pour autant", () => {
    // Given
    const listing = privateListing('Porsche 911 Carrera 1998');

    // When
    const verdict = verdictOf(listing, settings, null);

    // Then
    expect(verdict.pass).toBe(true);
  });

  it('les Italiennes décochées dans les réglages, une Ferrari 360 Modena est écartée comme marque hors des familles suivies', () => {
    // Given
    const withoutItalians: Settings = {
      ...settings,
      families: { ...settings.families, italiennes: { ...settings.families.italiennes, enabled: false } },
    };
    const listing = privateListing('Ferrari 360 Modena 2001 45 000 km');

    // When
    const verdict = verdictOf(listing, withoutItalians);

    // Then
    expect(verdict.rejections).toEqual([{ kind: 'unfollowedBrand', make: 'Ferrari' }]);
  });

  it('une Mazda MX-5 reçue dans une alerte est écartée comme marque hors des familles suivies, la raison nommant la marque', () => {
    // Given
    const listing = privateListing('Mazda MX-5 1.8 2002 98 000 km 6 500 €');

    // When
    const verdict = verdictOf(listing, settings, 30);

    // Then
    expect(verdict.pass).toBe(false);
    expect(verdict.rejections).toEqual([{ kind: 'unfollowedBrand', make: 'Mazda' }]);
  });
});

describe('règle « supercar et collection »', () => {
  it('une Mercedes GLE de 2019 à 52 000 € est retenue par son seul prix, au-dessus du plancher de 40 000 € des allemandes', () => {
    // Given
    const listing = privateListing('Mercedes GLE 350 d 4Matic 2019 60 000 km 52 000 €');

    // When
    const reason = specialReason(settings.families.allemandes, infoOf(listing), listing);

    // Then
    expect(reason).toEqual({ kind: 'priceFloor', minPrice: 40000 });
    expect(verdictOf(listing).pass).toBe(true);
  });

  it('une Mercedes 190 E de 1989 à 6 500 € est retenue par sa seule année, avant 1995', () => {
    // Given
    const listing = privateListing('Mercedes 190 E 2.0 1989 95 000 km 6 500 €');

    // When
    const reason = specialReason(settings.families.allemandes, infoOf(listing), listing);

    // Then
    expect(reason).toEqual({ kind: 'yearCap', maxYear: 1995 });
    expect(verdictOf(listing).pass).toBe(true);
  });

  it('les mots-clés « M3 », « 3.0 CSL » et « R.S. » se reconnaissent dans un titre, chiffres et points compris', () => {
    // Given
    const m3 = privateListing('BMW M3 E46 2004 98 000 km 24 900 €');
    const csl = privateListing('BMW 3.0 CSL Batmobile');
    const clioRs = privateListing('Renault Clio R.S. 2016 60 000 km 18 000 €');

    // When
    const reasons = [
      specialReason(settings.families.allemandes, infoOf(m3), m3),
      specialReason(settings.families.allemandes, infoOf(csl), csl),
      specialReason(settings.families.francaises, infoOf(clioRs), clioRs),
    ];

    // Then
    expect(reasons).toEqual([
      { kind: 'keyword', keyword: 'M3' },
      { kind: 'keyword', keyword: '3.0 CSL' },
      { kind: 'keyword', keyword: 'R.S.' },
    ]);
  });
});
