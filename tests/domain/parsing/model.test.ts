import { describe, expect, it } from 'vitest';
import { extractModel } from '../../../src/domain/parsing/model.js';
import { type ExtractionContext, extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { fingerprint } from '../../../src/domain/vehicle/identity.js';
import { rawListing } from '../../support/rawListing.js';

const context: ExtractionContext = { customBrands: [], currentYear: 2026 };

describe("modèle lu dans le titre d'une annonce", () => {
  it('« Ford Autres - Ford ranger raptor » : le modèle est pris dans les mots du vendeur', () => {
    // Given
    const infoOf = (title: string) => extractVehicleInfo(rawListing(title), context);
    const raptor = rawListing('Ford Autres - Ford ranger raptor', { postalCode: '33000' });
    const mustang = rawListing('Ford Autres - Ford Mustang GT', { postalCode: '33000' });

    // When
    const ranger = infoOf('Ford Autres - Ford ranger raptor');
    const peugeot = infoOf('Peugeot Autres - Peugeot 203');
    const ds = infoOf('Citroen Autres - Vente de Citroën DS 5 super');
    const renault = infoOf('Renault Autres - Renault 4cv cabriolet');
    const doubleCab = infoOf('Ford Ranger RANGER DOUBLE CABINE 3.2 TDCi');
    const raptorFingerprint = fingerprint(extractVehicleInfo(raptor, context), raptor);
    const mustangFingerprint = fingerprint(extractVehicleInfo(mustang, context), mustang);

    // Then
    expect(ranger).toMatchObject({ make: 'Ford', model: 'ranger raptor' });
    expect(peugeot).toMatchObject({ make: 'Peugeot', model: '203' });
    expect(ds).toMatchObject({ make: 'Citroën', model: 'DS 5 super' });
    expect(renault).toMatchObject({ make: 'Renault', model: '4cv cabriolet' });
    expect(doubleCab).toMatchObject({ make: 'Ford', model: 'Ranger DOUBLE CABINE' });
    expect(raptorFingerprint).not.toBe(mustangFingerprint);
  });

  it('« Citroen Autres - Acadiane Citroen » donne le modèle « Acadiane Citroen », « Renault Autres - Renault 1929 » ne laisse que la marque', () => {
    // Given
    const acadiane = rawListing('Citroen Autres - Acadiane Citroen');
    const renault1929 = rawListing('Renault Autres - Renault 1929');

    // When
    const acadianeInfo = extractVehicleInfo(acadiane, context);
    const renault1929Info = extractVehicleInfo(renault1929, context);

    // Then
    expect(acadianeInfo).toMatchObject({ make: 'Citroën', model: 'Acadiane Citroen' });
    expect(renault1929Info.model).toBeUndefined();
  });

  it('« BMW Série 3 », « DS 5 » et « Golf 7 », le petit nombre fait partie du modèle', () => {
    // Given
    const titles = ['BMW Série 3 320d 2.0 184ch', 'Citroën DS 5 Sport Chic 2.0 HDi', 'Volkswagen Golf 7 GTI 2.0 TSI 230ch'];

    // When
    const models = titles.map((title) => extractVehicleInfo(rawListing(title), context).model);

    // Then
    expect(models).toEqual(['Série 3 320d', 'DS 5 Sport', 'Golf 7 GTI']);
  });

  it('« Citroën 2cv » et « Renault 4cv », le nombre suivi de « cv » est le modèle', () => {
    // Given
    const titles = ['Citroën 2cv 6 Spécial', 'Renault 4cv'];

    // When
    const models = titles.map((title) => extractVehicleInfo(rawListing(title), context).model);

    // Then
    expect(models).toEqual(['2cv 6 Spécial', '4cv']);
  });

  it('une puissance « 450ch » après le modèle est de la fiche technique, pas du nom', () => {
    // Given
    const title = 'Porsche 911 Carrera 4S 3.0 450ch PDK';

    // When
    const model = extractModel(title, 'Porsche'.length);

    // Then
    expect(model).toBe('911 Carrera 4S');
  });
});
