import { describe } from 'vitest';
import { fakeVehicleRepository } from '../fakes/fakeVehicleRepository.js';
import { vehicleRepositoryContract } from './vehicleRepository.contract.js';

describe('VehicleRepository en mémoire', () => {
  vehicleRepositoryContract(fakeVehicleRepository);
});
