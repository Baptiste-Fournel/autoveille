import { describe, expect, it } from 'vitest';
import { brandsOfFamily } from '../../../src/domain/catalog/brands.js';
import { mergeSettings, type StoredSettings } from '../../../src/domain/settings/merge.js';

const germanBrandsOfTheFirstVersion = [
  'Porsche',
  'Mercedes-Benz',
  'BMW',
  'Audi',
  'Volkswagen',
  'Alpina',
  'Ruf',
  'Wiesmann',
  'Opel',
  'Smart',
];

const savedByTheFirstVersion: StoredSettings = {
  dealer: { firstName: 'Jean', lastName: 'Nom', company: 'Garage du Lac', city: 'Mérignac', phone: '06 00 00 00 00' },
  zone: { city: 'Bordeaux', postalCode: '33000', lat: 44.8378, lon: -0.5792, radiusKm: 100 },
  maxKm: 120_000,
  privateOnly: true,
  specialOnly: true,
  families: {
    allemandes: {
      enabled: true,
      brands: ['Porsche', 'Mercedes-Benz', 'BMW', 'Alpina'],
      known: germanBrandsOfTheFirstVersion,
      minPrice: 40_000,
      maxYear: 1995,
      keywords: ['911', 'GT3', 'AMG', 'M3'],
    },
    autres: { enabled: false, brands: [], known: [], minPrice: 0, maxYear: 0, keywords: [] },
  },
  notifications: { push: true, telegramToken: '', telegramChatId: '' },
  imap: { host: 'imap.gmail.com', port: 993, user: '', pass: '', mailbox: 'INBOX' },
  httpSites: [],
};

describe('réglages enregistrés par une version précédente', () => {
  it('les exemples livrés par la première version (« Nom », « 06 00 00 00 00 »…) comptent comme vides, les champs remplis restent', () => {
    // Given
    const stored = savedByTheFirstVersion;

    // When
    const settings = mergeSettings(stored);

    // Then
    expect(settings.dealer).toEqual({ firstName: 'Jean', lastName: '', company: 'Garage du Lac', city: 'Mérignac', phone: '' });
  });

  it('les marques ajoutées au catalogue depuis la première version (Toyota, Mazda…) apparaissent sans être cochées, et Audi reste décochée', () => {
    // Given
    const stored = savedByTheFirstVersion;

    // When
    const settings = mergeSettings(stored);

    // Then
    expect(settings.families.autres.known).toEqual(brandsOfFamily('autres'));
    expect(settings.families.autres.known).toContain('Toyota');
    expect(settings.families.autres.brands).toEqual([]);
    expect(settings.families.allemandes.brands).toEqual(['Porsche', 'Mercedes-Benz', 'BMW', 'Alpina']);
    expect(settings.families.allemandes.known).toEqual(germanBrandsOfTheFirstVersion);
  });

  it('des réglages d’avant les alertes de sites reçoivent une liste d’alertes vide et gardent leurs choix', () => {
    // Given
    const stored = savedByTheFirstVersion;

    // When
    const settings = mergeSettings(stored);

    // Then
    expect(settings.alerts).toEqual({});
    expect(settings.alertsDone).toEqual({});
    expect(settings.maxKm).toBe(120_000);
  });
});
