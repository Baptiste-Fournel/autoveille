import { expect, it } from 'vitest';
import type { Transaction } from '../../src/application/ports/transaction.js';
import type { VehicleRepository } from '../../src/application/ports/vehicleRepository.js';
import { newListing } from '../../src/domain/vehicle/changes.js';
import { FORD_MUSTANG_MERGED, FORD_RANGER_RAPTOR, firstSighting, storeFirstSighting } from './vehicleSamples.js';

export interface TransactionalStore {
  readonly transaction: Transaction;
  readonly vehicles: VehicleRepository;
}

export function transactionContract(create: () => TransactionalStore): void {
  it('une réparation interrompue après la création de la voiture séparée ne laisse ni cette voiture ni l’annonce déplacée', () => {
    // Given
    const { transaction, vehicles } = create();
    const ford = storeFirstSighting(vehicles, FORD_RANGER_RAPTOR, '2026-10-05T07:00:00.000Z');
    const mergedId = vehicles.addListing(ford.vehicleId, newListing(FORD_MUSTANG_MERGED, '2026-10-06T07:00:00.000Z'));
    const before = vehicles.allVehicles();

    // When
    const interrupted = (): void =>
      transaction.run(() => {
        const mustangId = vehicles.addVehicle(firstSighting(FORD_MUSTANG_MERGED, '2026-10-06T07:00:00.000Z').vehicle);
        vehicles.moveListings([mergedId], mustangId);
        throw new Error('disk I/O error');
      });

    // Then
    expect(interrupted).toThrow('disk I/O error');
    expect(vehicles.allVehicles()).toEqual(before);
    expect(vehicles.listingsOf(ford.vehicleId).map((listing) => listing.id)).toEqual([ford.listingId, mergedId]);
  });

  it('une ingestion qui aboutit écrit la voiture, son annonce et son événement, et rend ce que la transaction a produit', () => {
    // Given
    const { transaction, vehicles } = create();
    const sighting = firstSighting(FORD_RANGER_RAPTOR, '2026-10-05T07:00:00.000Z');

    // When
    const vehicleId = transaction.run(() => {
      const id = vehicles.addVehicle(sighting.vehicle);
      vehicles.addListing(id, sighting.listing);
      vehicles.addEvent(id, { type: 'nouveau', detail: 'Leboncoin', at: '2026-10-05T07:00:00.000Z' });
      return id;
    });

    // Then
    expect(vehicles.vehicle(vehicleId)).toEqual({ id: vehicleId, ...sighting.vehicle });
    expect(vehicles.listingsOf(vehicleId)).toHaveLength(1);
    expect(vehicles.events(vehicleId).map((event) => event.type)).toEqual(['nouveau']);
  });

  it('une transaction ne peut pas attendre le réseau : un travail asynchrone est refusé et n’écrit rien', () => {
    // Given
    const { transaction, vehicles } = create();
    const sighting = firstSighting(FORD_RANGER_RAPTOR, '2026-10-05T07:00:00.000Z');

    // When
    const awaitingGeocoding = (): Promise<number> =>
      transaction.run(async () => {
        const id = vehicles.addVehicle(sighting.vehicle);
        await Promise.resolve();
        return id;
      });

    // Then
    expect(awaitingGeocoding).toThrow(TypeError);
    expect(vehicles.allVehicles()).toEqual([]);
  });
}
