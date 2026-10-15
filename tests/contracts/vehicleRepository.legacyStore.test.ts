import { describe } from 'vitest';
import { Store } from '../../src/db.js';
import { storeRepositories } from '../../src/storeRepositories.js';
import { vehicleRepositoryContract } from './vehicleRepository.contract.js';

describe('VehicleRepository sur l’ancien Store (adaptateur transitoire)', () => {
  vehicleRepositoryContract(() => storeRepositories(new Store(':memory:')).vehicles);
});
