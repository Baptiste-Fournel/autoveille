import type { Random } from '../../src/application/ports/random.js';
import type { Settings } from '../../src/domain/settings/types.js';
import { type FakeClock, fakeClock } from '../fakes/fakeClock.js';
import { type FakeGeocoder, fakeGeocoder } from '../fakes/fakeGeocoder.js';
import { type FakePersistence, fakePersistence } from '../fakes/fakePersistence.js';
import { fakeRandom } from '../fakes/fakeRandom.js';

export interface SettingsWorld extends FakePersistence {
  readonly geocoder: FakeGeocoder;
  readonly random: Random;
  readonly clock: FakeClock;
}

export const settingsWorld = (saved?: Settings): SettingsWorld => {
  const persistence = fakePersistence();
  if (saved !== undefined) {
    persistence.settings.save(saved);
  }
  return { ...persistence, geocoder: fakeGeocoder(), random: fakeRandom(), clock: fakeClock() };
};
