import { describe } from 'vitest';
import { fakeGeocoder } from '../fakes/fakeGeocoder.js';
import { geocoderContract } from './geocoder.contract.js';

describe('Geocoder en mémoire', () => {
  geocoderContract(() => fakeGeocoder());
});
