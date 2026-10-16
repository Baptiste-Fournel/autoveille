import { describe } from 'vitest';
import { fakeTransaction } from '../fakes/fakeTransaction.js';
import { fakeVehicleRepository } from '../fakes/fakeVehicleRepository.js';
import { transactionContract } from './transaction.contract.js';

describe('Transaction en mémoire', () => {
  transactionContract(() => {
    const vehicles = fakeVehicleRepository();
    return { transaction: fakeTransaction(vehicles), vehicles };
  });
});
