import { describe, expect, it } from 'vitest';
import { updateSettings } from '../../../src/application/settings/updateSettings.js';
import { recordAlertConfirmation } from '../../../src/domain/settings/alerts.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { InvalidSettings } from '../../../src/domain/settings/invalidSettings.js';
import type { AlertInfo } from '../../../src/domain/settings/types.js';
import { AUDI_A3, BMW_M3_E46, PORSCHE_911_4S, storeFirstSighting } from '../../contracts/vehicleSamples.js';
import { GIRONDE, LIBOURNE } from '../../fakes/fakeGeocoder.js';
import { garageDuLac } from '../../support/dealer.js';
import { settingsWithDealerMailbox } from '../../support/dealerMailbox.js';
import { settingsWorld } from '../../support/settingsWorld.js';

const THIS_WEEK = '2026-10-13T07:15:00.000Z';

const laCentraleConfirmation: AlertInfo = {
  site: 'lacentrale',
  criteria: '100 000 km max, 33000, particuliers',
  confirmedAt: '2026-10-14T16:25:03.000Z',
  manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
  maxKm: 100000,
  postalCode: '33000',
  sellerType: 'particulier',
};

describe('enregistrer les réglages', () => {
  it('élargir le kilométrage à 150 000 km fait passer la BMW M3 E46 de la semaine des écartées aux retenues', async () => {
    // Given
    const world = settingsWorld();
    storeFirstSighting(world.vehicles, PORSCHE_911_4S, THIS_WEEK);
    const bmw = storeFirstSighting(world.vehicles, BMW_M3_E46, THIS_WEEK);
    storeFirstSighting(world.vehicles, AUDI_A3, THIS_WEEK);

    // When
    const update = await updateSettings(world, { maxKm: 150_000 });

    // Then
    expect(update.preview).toEqual({ total: 3, pass: 2 });
    expect(update.warning).toBeUndefined();
    expect(world.settings.load().maxKm).toBe(150_000);
    expect(world.vehicles.vehicle(bmw.vehicleId)).toMatchObject({ matched: true, rejections: [] });
  });

  it('la zone déplacée de Bordeaux à Libourne, rayon de 30 km, est géocodée et écarte la 911 de Mérignac', async () => {
    // Given
    const world = settingsWorld();
    const porsche = storeFirstSighting(world.vehicles, PORSCHE_911_4S, THIS_WEEK);
    const zone = { city: 'Libourne', postalCode: '33500', lat: 44.8378, lon: -0.5792, radiusKm: 30 };

    // When
    const update = await updateSettings(world, { zone });

    // Then
    expect(update.settings.zone).toEqual({ ...zone, lat: LIBOURNE.lat, lon: LIBOURNE.lon });
    expect(world.settings.load().zone).toEqual(update.settings.zone);
    expect(world.geocoder.queries()).toEqual([{ city: 'Libourne', postalCode: '33500' }]);
    expect(world.vehicles.vehicle(porsche.vehicleId)?.matched).toBe(false);
    expect(world.vehicles.vehicle(porsche.vehicleId)?.rejections.map((reason) => reason.kind)).toEqual(['outsideRadius']);
  });

  it('une zone à « Saint-Émilion » sans code postal, ville introuvable : le filtre de distance est désactivé et l’enregistrement le signale', async () => {
    // Given
    const world = settingsWorld();
    const zone = { ...defaultSettings().zone, city: 'Saint-Émilion', postalCode: '' };

    // When
    const update = await updateSettings(world, { zone });

    // Then
    expect(update.warning).toBe('cityNotFound');
    expect(world.settings.load().zone).toMatchObject({ city: 'Saint-Émilion', lat: null, lon: null });
  });

  it('« Saint-Émilion 33330 », reconnue seulement par son département : distance depuis le centre de la Gironde, et l’enregistrement le signale', async () => {
    // Given
    const world = settingsWorld();
    const zone = { ...defaultSettings().zone, city: 'Saint-Émilion', postalCode: '33330' };

    // When
    const update = await updateSettings(world, { zone });

    // Then
    expect(update.warning).toBe('cityLocatedByDepartment');
    expect(world.settings.load().zone).toMatchObject({ city: 'Saint-Émilion', lat: GIRONDE.lat, lon: GIRONDE.lon });
  });

  it('enregistrer les gabarits sans toucher à la zone ne la géocode pas à nouveau', async () => {
    // Given
    const world = settingsWorld();
    const templates = { ...defaultSettings().templates, autres: { variants: ['Bonjour, votre {modele} m’intéresse. {prenom}'] } };

    // When
    await updateSettings(world, { templates });

    // Then
    expect(world.geocoder.queries()).toEqual([]);
    expect(world.settings.load().templates.autres.variants).toEqual(['Bonjour, votre {modele} m’intéresse. {prenom}']);
  });

  it('corriger seulement le code postal de la zone (33000 devient 33300) la fait géocoder à nouveau', async () => {
    // Given
    const world = settingsWorld();
    const zone = { ...defaultSettings().zone, postalCode: '33300' };

    // When
    await updateSettings(world, { zone });

    // Then
    expect(world.geocoder.queries()).toEqual([{ city: 'Bordeaux', postalCode: '33300' }]);
  });

  it('enregistrer seulement le kilométrage garde la boîte mail et la concession déjà enregistrées', async () => {
    // Given
    const saved = settingsWithDealerMailbox({ dealer: garageDuLac });
    const world = settingsWorld(saved);

    // When
    await updateSettings(world, { maxKm: 150_000 });

    // Then
    expect(world.settings.load()).toEqual({ ...saved, maxKm: 150_000 });
  });

  it('des réglages ouverts avant l’arrivée de la confirmation La Centrale ne l’effacent pas en étant enregistrés', async () => {
    // Given
    const openedBefore = defaultSettings();
    const world = settingsWorld(recordAlertConfirmation(openedBefore, laCentraleConfirmation));

    // When
    await updateSettings(world, { ...openedBefore, maxKm: 150_000 });

    // Then
    expect(world.settings.load().maxKm).toBe(150_000);
    expect(world.settings.load().alerts).toEqual({ lacentrale: laCentraleConfirmation });
    expect(world.settings.load().alertsDone).toEqual({ lacentrale: true });
  });

  it('la recherche Leparking ajoutée sans identifiant depuis l’écran Sites en reçoit un', async () => {
    // Given
    const world = settingsWorld();
    const leparking = { id: '', name: 'Leparking', url: 'https://www.leparking.fr/voiture-occasion/bmw-m3.html', enabled: true };

    // When
    const update = await updateSettings(world, { httpSites: [leparking] });

    // Then
    expect(update.settings.httpSites).toEqual([{ ...leparking, id: '00000001' }]);
    expect(world.settings.load().httpSites).toEqual(update.settings.httpSites);
  });

  it('une zone dont la ville et le code postal ont été effacés est refusée, et rien n’est enregistré ni réévalué', async () => {
    // Given
    const world = settingsWorld();
    const bmw = storeFirstSighting(world.vehicles, BMW_M3_E46, THIS_WEEK);
    const zone = { ...defaultSettings().zone, city: ' ', postalCode: '' };

    // When
    const update = updateSettings(world, { zone, maxKm: 150_000 });

    // Then
    await expect(update).rejects.toEqual(new InvalidSettings('missingZoneCity'));
    expect(world.settings.load()).toEqual(defaultSettings());
    expect(world.vehicles.vehicle(bmw.vehicleId)?.matched).toBe(false);
  });
});
