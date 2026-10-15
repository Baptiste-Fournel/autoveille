import { describe, expect, it } from 'vitest';
import { getVehicle } from '../../../src/application/vehicles/getVehicle.js';
import { updateVehicle } from '../../../src/application/vehicles/updateVehicle.js';
import { VehicleNotFound } from '../../../src/application/vehicles/vehicleNotFound.js';
import { UnknownStatus } from '../../../src/domain/vehicle/status.js';
import { ALPINE_A110, BMW_M3_E46, MUSTANG_GT, PORSCHE_911_4S, storeFirstSighting } from '../../contracts/vehicleSamples.js';
import { FAKE_NOW, fakeClock } from '../../fakes/fakeClock.js';
import { fakePersistence } from '../../fakes/fakePersistence.js';

const KEPT = { matched: true, rejections: [] } as const;

const world = () => ({ ...fakePersistence(), clock: fakeClock() });

const typesOf = (events: readonly { readonly type: string }[]): readonly string[] => events.map((event) => event.type);

describe('suivre une annonce depuis sa carte', () => {
  it('« Oui, envoyé » : la Mustang passe en « contactée », et sa fiche donne l’heure du contact', () => {
    // Given
    const app = world();
    const mustang = storeFirstSighting(app.vehicles, MUSTANG_GT, '2026-10-14T07:00:00.000Z', KEPT);

    // When
    const sheet = updateVehicle(app, mustang.vehicleId, { status: 'contacte' });

    // Then
    expect(sheet.vehicle.status).toBe('contacte');
    expect(sheet.contactedAt).toBe(FAKE_NOW);
    expect(typesOf(sheet.events)).toEqual(['statut_contacte']);
  });

  it('« Pas encore contactée » après un appui par erreur sur « Oui, envoyé » : la 911 revient à traiter et son contact est effacé', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);
    updateVehicle(app, porsche.vehicleId, { status: 'contacte' });
    app.clock.advanceBy(4_000);

    // When
    const sheet = updateVehicle(app, porsche.vehicleId, { status: 'nouveau' });

    // Then
    expect(sheet.vehicle.status).toBe('nouveau');
    expect(sheet.contactedAt).toBeNull();
    expect(typesOf(sheet.events)).toEqual(['statut_nouveau']);
  });

  it('« Ne plus contacter » : le vendeur de l’Alpine est mis de côté, l’annonce passe dans les ignorées et l’événement est noté', () => {
    // Given
    const app = world();
    const alpine = storeFirstSighting(app.vehicles, ALPINE_A110, '2026-10-12T08:00:00.000Z', { ...KEPT, status: 'contacte' });

    // When
    const sheet = updateVehicle(app, alpine.vehicleId, { doNotContact: true });

    // Then
    expect(sheet.vehicle).toMatchObject({ status: 'ignore', doNotContact: true });
    expect(typesOf(sheet.events)).toEqual(['ne_plus_contacter']);
  });

  it('« Garder quand même » la BMW M3 écartée pour ses 128 000 km : elle est retenue sans raison d’écart, remise à traiter, et le choix est noté', () => {
    // Given
    const app = world();
    const bmw = storeFirstSighting(app.vehicles, BMW_M3_E46, '2026-10-10T07:35:00.000Z', {
      matched: false,
      rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
    });

    // When
    const sheet = updateVehicle(app, bmw.vehicleId, { keep: true, status: 'nouveau' });

    // Then
    expect(sheet.vehicle).toMatchObject({ matched: true, rejections: [], status: 'nouveau' });
    expect(typesOf(sheet.events)).toEqual(['garde_manuellement', 'statut_nouveau']);
  });

  it('le concessionnaire note le rendez-vous pris avec le vendeur de la Mustang, puis réécrit le message proposé', () => {
    // Given
    const app = world();
    const mustang = storeFirstSighting(app.vehicles, MUSTANG_GT, '2026-10-14T07:00:00.000Z', KEPT);
    const rewritten = 'Bonjour, votre Mustang m’intéresse, je peux passer la voir samedi matin à Arcachon. Jean Dupont, Garage du Lac';

    // When
    updateVehicle(app, mustang.vehicleId, { note: 'RDV samedi 10 h à Arcachon, carnet d’entretien à vérifier' });
    const sheet = updateVehicle(app, mustang.vehicleId, { message: rewritten });

    // Then
    expect(sheet.vehicle.note).toBe('RDV samedi 10 h à Arcachon, carnet d’entretien à vérifier');
    expect(sheet.message).toBe(rewritten);
    expect(sheet.vehicle.messageOverride).toBe(rewritten);
    expect(sheet.events).toEqual([]);
  });

  it('vider le message réécrit de la Mustang rétablit le message proposé', () => {
    // Given
    const app = world();
    const mustang = storeFirstSighting(app.vehicles, MUSTANG_GT, '2026-10-14T07:00:00.000Z', KEPT);
    const proposed = getVehicle(app, mustang.vehicleId).message;
    updateVehicle(app, mustang.vehicleId, { message: 'Bonjour, votre Mustang m’intéresse.' });

    // When
    const sheet = updateVehicle(app, mustang.vehicleId, { message: '   ' });

    // Then
    expect(sheet.vehicle.messageOverride).toBeNull();
    expect(sheet.message).toBe(proposed);
  });

  it('un statut inconnu (« vendu ») est refusé et l’annonce reste telle quelle', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);

    // When
    const marking = () => updateVehicle(app, porsche.vehicleId, { status: 'vendu', note: 'Vendue à un autre garage' });

    // Then
    expect(marking).toThrow(UnknownStatus);
    const sheet = getVehicle(app, porsche.vehicleId);
    expect(sheet.vehicle).toMatchObject({ status: 'nouveau', note: null });
    expect(sheet.events).toEqual([]);
  });

  it('modifier une annonce supprimée depuis un autre appareil est introuvable', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);
    app.vehicles.deleteVehicle(porsche.vehicleId);

    // When
    const marking = () => updateVehicle(app, porsche.vehicleId, { status: 'contacte' });

    // Then
    expect(marking).toThrow(VehicleNotFound);
  });
});
