import { describe, expect, it } from 'vitest';
import { alertAdviceSentence } from '../../../src/domain/presentation/alerts.js';
import { targetedSearchLabel } from '../../../src/domain/presentation/targetedSearches.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { AlertInfo, Settings } from '../../../src/domain/settings/types.js';
import {
  alertBounds,
  type BrandsSearch,
  type SiteSetup,
  siteSetups,
  type TargetedSearch,
  targetedSearches,
} from '../../../src/domain/sites/alertSetup.js';
import { alertAdvice } from '../../../src/domain/sites/confirmations.js';

const defaults = defaultSettings();

const searchLinkOf = (setups: readonly SiteSetup[], key: string): { searchUrl: string; prefilled: boolean } | undefined => {
  const setup = setups.find((site) => site.key === key);
  return setup && { searchUrl: setup.searchUrl, prefilled: setup.prefilled };
};

describe('largeur conseillée pour une alerte de site', () => {
  it('une alerte réglée au plus juste reçoit le conseil d’élargir à 150 km et 150 000 km, sauf le rayon ParuVendu plafonné à 100 km', () => {
    // Arrange
    const settings: Settings = { ...defaults, zone: { ...defaults.zone, radiusKm: 100 }, maxKm: 100_000 };
    const advice = (alert: AlertInfo): string | undefined => {
      const widening = alertAdvice(alert, settings);
      return widening && alertAdviceSentence(widening);
    };
    const laCentraleAtSettings: AlertInfo = { site: 'lacentrale', criteria: '', confirmedAt: '', radiusKm: 100, maxKm: 100000 };
    const paruVenduAtSettings: AlertInfo = { site: 'paruvendu', criteria: '', confirmedAt: '', radiusKm: 100, maxKm: 100000 };
    const paruVenduWide: AlertInfo = { site: 'paruvendu', criteria: '', confirmedAt: '', radiusKm: 200, maxKm: 150000 };
    const autoScout24WithoutCriteria: AlertInfo = { site: 'autoscout24', criteria: '', confirmedAt: '' };

    // Act
    const bounds = alertBounds(settings);
    const [laCentrale, paruVendu, wide, withoutCriteria] = [
      laCentraleAtSettings,
      paruVenduAtSettings,
      paruVenduWide,
      autoScout24WithoutCriteria,
    ].map(advice);

    // Assert
    expect(bounds).toEqual({ radiusKm: 150, maxKm: 150000 });
    expect(laCentrale).toMatch(/150 km de rayon, 150 000 km au compteur/);
    expect(paruVendu).toMatch(/\(150 000 km au compteur\)/);
    expect(wide).toBeUndefined();
    expect(withoutCriteria).toBeUndefined();
  });
});

describe('liens « Créer l’alerte » de l’écran Sites', () => {
  it('les liens de Leboncoin, La Centrale et AutoScout24 sont pré-remplis avec la zone, 150 000 km et particuliers ; les autres sites mènent à leur recherche vierge', () => {
    // Arrange
    const settings = defaults;

    // Act
    const setups = siteSetups(settings);

    // Assert
    expect(searchLinkOf(setups, 'leboncoin')).toEqual({
      searchUrl:
        'https://www.leboncoin.fr/recherche?category=2&locations=Bordeaux__44.8378_-0.5792_5000_150000&owner_type=private&mileage=min-150000',
      prefilled: true,
    });
    expect(searchLinkOf(setups, 'lacentrale')).toEqual({
      searchUrl: 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART&dptCp=33000&mileageMax=150000',
      prefilled: true,
    });
    expect(searchLinkOf(setups, 'autoscout24')).toEqual({
      searchUrl: 'https://www.autoscout24.fr/lst?custtype=P&kmto=150000&zip=33000&zipr=150&cy=F&atype=C',
      prefilled: true,
    });
    expect(setups.filter((setup) => !setup.prefilled).map((setup) => setup.searchUrl)).toEqual([
      'https://occasion.largus.fr/voiture-occasion/',
      'https://www.ouestfrance-auto.com/voiture-occasion/',
      'https://www.annonces-automobile.com/',
      'https://www.leparking.fr/voiture-occasion/',
    ]);
    expect(setups.every((setup) => setup.alertRadiusKm === 150 && setup.alertMaxKm === 150_000)).toBe(true);
  });

  it('ParuVendu n’est pré-rempli que pour Bordeaux, seule ville dont le code INSEE est connu ; ailleurs le lien mène à la recherche vierge', () => {
    // Arrange
    const merignac: Settings = { ...defaults, zone: { ...defaults.zone, city: 'Mérignac', postalCode: '33700' } };

    // Act
    const bordeaux = searchLinkOf(siteSetups(defaults), 'paruvendu');
    const elsewhere = searchLinkOf(siteSetups(merignac), 'paruvendu');

    // Assert
    expect(bordeaux).toEqual({
      searchUrl:
        'https://www.paruvendu.fr/auto-moto/listefo/default/default?reaf=1&codeINSEE=33063%2C&ray=150&r=VVO00000&km1=150000&codPro=off',
      prefilled: true,
    });
    expect(elsewhere).toEqual({ searchUrl: 'https://www.paruvendu.fr/voiture-occasion/', prefilled: false });
  });
});

describe('alertes ciblées La Centrale', () => {
  it('les alertes ciblées La Centrale : trois marques au plus par recherche, prix plancher aux trois quarts arrondi à 5 000 €, libellés avec les noms saisis', () => {
    // Arrange
    const settings: Settings = {
      ...defaults,
      families: {
        ...defaults.families,
        allemandes: {
          ...defaults.families.allemandes,
          enabled: true,
          brands: ['Porsche', 'Mercedes-Benz', 'BMW', 'Audi', 'Alpina'],
          minPrice: 40000,
          maxYear: 1995,
        },
        italiennes: {
          ...defaults.families.italiennes,
          enabled: true,
          brands: ['Ferrari', 'Lamborghini', 'Maserati', 'Pagani', 'Alfa Romeo', 'Lancia', 'De Tomaso'],
          minPrice: 30000,
          maxYear: 1995,
        },
        americaines: {
          ...defaults.families.americaines,
          enabled: true,
          brands: ['Ford', 'Chevrolet', 'Dodge', 'Jeep'],
          minPrice: 15000,
          maxYear: 1995,
        },
        francaises: { ...defaults.families.francaises, enabled: false },
      },
    };

    // Act
    const out = targetedSearches(settings, 'lacentrale');

    // Assert
    const brandSearches = out.filter((search): search is BrandsSearch => search.kind === 'brands');
    const startingWith = (code: string): BrandsSearch | undefined => brandSearches.find((search) => search.brands[0] === code);
    const including = (code: string): BrandsSearch | undefined => brandSearches.find((search) => search.brands.includes(code));
    const labelOf = (search: TargetedSearch | undefined): string | undefined => search && targetedSearchLabel(search);
    expect(brandSearches.every((t) => t.brands.length <= 3)).toBe(true);
    expect(startingWith('PORSCHE')?.minPrice).toBe(30000);
    expect(including('MERCEDES')?.brands).toEqual(['MERCEDES']);
    expect(including('FERRARI')?.brands).toEqual(['FERRARI', 'LAMBORGHINI', 'MASERATI']);
    expect(including('FORD:MUSTANG')?.url).toContain('FORD%3AMUSTANG%3BCHEVROLET%3BDODGE');
    expect(including('JEEP')?.minPrice).toBe(10000);
    expect(labelOf(startingWith('BMW'))).toMatch(/^BMW à partir de 30/);
    expect(labelOf(including('LANCIA'))).toContain('Pagani, Alfa Romeo, Lancia');
    expect(labelOf(including('DE TOMASO'))).toMatch(/^De Tomaso à partir de 20/);
    expect(labelOf(including('FORD:MUSTANG'))).toMatch(/^Ford Mustang, Chevrolet, Dodge/);
    expect(including('FORD:BRONCO')).toMatchObject({ brands: ['FORD:GT', 'FORD:BRONCO', 'FORD:F-150'], minPrice: 10000 });
    expect(labelOf(including('FORD:BRONCO'))).toMatch(/^Ford GT, Ford Bronco, Ford F-150/);
    expect(out[out.length - 1]).toMatchObject({ kind: 'collection', maxYear: 1995 });
    expect(out[out.length - 1]?.url).toContain('yearMax=1995');
    expect(out.every((t) => t.url.includes('customerFamilyCodes=PART') && t.url.includes('distance=5'))).toBe(true);
  });

  it('les alertes ciblées ne concernent que La Centrale, dont l’email ne montre que trois annonces', () => {
    // Arrange
    const settings = defaults;

    // Act
    const leboncoin = targetedSearches(settings, 'leboncoin');
    const laCentrale = targetedSearches(settings, 'lacentrale');

    // Assert
    expect(leboncoin).toEqual([]);
    expect(laCentrale.length).toBeGreaterThan(0);
  });
});
