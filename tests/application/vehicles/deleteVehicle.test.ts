import { describe, expect, it } from 'vitest';
import { deleteVehicle } from '../../../src/application/vehicles/deleteVehicle.js';
import { getVehicle } from '../../../src/application/vehicles/getVehicle.js';
import { listVehicles } from '../../../src/application/vehicles/listVehicles.js';
import { VehicleNotFound } from '../../../src/application/vehicles/vehicleNotFound.js';
import { FORD_RANGER_RAPTOR, PORSCHE_911_4S, storeFirstSighting } from '../../contracts/vehicleSamples.js';
import { fakeClock } from '../../fakes/fakeClock.js';
import { fakePersistence } from '../../fakes/fakePersistence.js';

const KEPT = { matched: true, rejections: [] } as const;

const world = () => ({ ...fakePersistence(), clock: fakeClock() });

describe('supprimer une annonce', () => {
  it('le concessionnaire supprime le ranger raptor lu de travers dans un email : il quitte la liste et n’a plus de fiche', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);
    const ranger = storeFirstSighting(app.vehicles, FORD_RANGER_RAPTOR, '2026-10-15T06:30:00.000Z', KEPT);

    // When
    deleteVehicle(app, ranger.vehicleId);

    // Then
    expect(listVehicles(app).vehicles.map((card) => card.vehicle.id)).toEqual([porsche.vehicleId]);
    expect(() => getVehicle(app, ranger.vehicleId)).toThrow(VehicleNotFound);
  });

  it('supprimer une annonce déjà supprimée depuis un autre appareil est introuvable', () => {
    // Given
    const app = world();
    const ranger = storeFirstSighting(app.vehicles, FORD_RANGER_RAPTOR, '2026-10-15T06:30:00.000Z', KEPT);
    deleteVehicle(app, ranger.vehicleId);

    // When
    const deletingAgain = () => deleteVehicle(app, ranger.vehicleId);

    // Then
    expect(deletingAgain).toThrow(VehicleNotFound);
  });
});
