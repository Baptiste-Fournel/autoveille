import { describe, expect, it } from 'vitest';
import { composeMessage, pickVariant } from '../../../src/domain/messaging/compose.js';
import { lintTemplate } from '../../../src/domain/messaging/lint.js';
import { type ExtractionContext, extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { garageDuLac } from '../../support/dealer.js';
import { rawListing } from '../../support/rawListing.js';

const context: ExtractionContext = { customBrands: [], currentYear: 2026 };

const settings = { ...defaultSettings(), dealer: garageDuLac };

const raw = rawListing('Porsche 911 Carrera S 2015 42 000 km 89 900 €', { site: 'leboncoin', siteLabel: 'Leboncoin', city: 'Pessac' });

describe('le message composé pour une voiture à partir des gabarits de sa famille', () => {
  it('une même voiture reçoit toujours la même variante, des voitures différentes se répartissent les variantes', () => {
    // Given
    const variants = settings.templates.allemandes.variants;

    // When
    const a = pickVariant(variants, 'abc');
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => pickVariant(variants, s)));

    // Then
    expect(pickVariant(variants, 'abc')).toBe(a);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('le message complet pour une 911 de Leboncoin passe la relecture sans avertissement', () => {
    // Given
    const info = extractVehicleInfo(raw, context);

    // When
    const msg = composeMessage(raw, info, settings, 'seed', 12);

    // Then
    expect(msg).toContain('Porsche 911 Carrera S');
    expect(msg).toContain('06 12 34 56 78');
    expect(msg).toContain('Garage du Lac');
    expect(msg).not.toMatch(/\{\w+\}/);
    expect(lintTemplate(msg)).toEqual([]);
  });

  it('une Mazda gardée quand même, rangée dans les autres marques, reçoit le gabarit des allemandes', () => {
    // Given
    const mazda = rawListing('Mazda MX-5 1.8 2002 98 000 km 6 500 €', { site: 'leboncoin', siteLabel: 'Leboncoin', city: 'Libourne' });
    const mazdaInfo = { make: 'Mazda', model: 'MX-5', family: 'autres', year: 2002, km: 98000, price: 6500 } as const;
    const seed = '8d71ce1f5739c8ed';

    // When
    const message = composeMessage(mazda, mazdaInfo, settings, seed, 35);

    // Then
    expect(message).not.toBe('');
    expect(message).toBe(composeMessage(mazda, { ...mazdaInfo, family: 'allemandes' }, settings, seed, 35));
  });
});
