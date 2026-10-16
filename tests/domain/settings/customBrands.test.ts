import { describe, expect, it } from 'vitest';
import { extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { customBrandsOf } from '../../../src/domain/settings/customBrands.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { Settings } from '../../../src/domain/settings/types.js';
import { rawListing } from '../../support/rawListing.js';

describe('marques connues des familles', () => {
  it('une Toyota ajoutée aux allemandes par l’utilisateur y est rangée, bien que Toyota reste connue dans les autres marques', () => {
    // Given
    const defaults = defaultSettings();
    const allemandes = defaults.families.allemandes;
    const settings: Settings = {
      ...defaults,
      families: {
        ...defaults.families,
        allemandes: { ...allemandes, brands: [...allemandes.brands, 'Toyota'], known: [...allemandes.known, 'Toyota'] },
      },
    };

    // When
    const info = extractVehicleInfo(rawListing('Toyota Supra 3.0 GR 340ch'), {
      customBrands: customBrandsOf(settings),
      currentYear: 2026,
    });

    // Then
    expect(settings.families.autres.known).toContain('Toyota');
    expect(info).toMatchObject({ make: 'Toyota', family: 'allemandes' });
  });
});
