import { type AttemptLimiter, createAttemptLimiter } from '../../src/application/auth/attemptLimiter.js';
import { type AuthenticationProblem, AuthenticationRefused } from '../../src/application/auth/authenticationRefused.js';
import type { PasswordHasher } from '../../src/application/ports/passwordHasher.js';
import type { Random } from '../../src/application/ports/random.js';
import { type FakeClock, fakeClock } from '../fakes/fakeClock.js';
import { fakePasswordHasher } from '../fakes/fakePasswordHasher.js';
import { fakeRandom } from '../fakes/fakeRandom.js';
import { type FakeSecretStore, fakeSecretStore } from '../fakes/fakeSecretStore.js';
import { type FakeSessionRepository, fakeSessionRepository } from '../fakes/fakeSessionRepository.js';

export const OWNER_PASSWORD = 'garage-bordeaux-2026';

export const OWNER_PASSWORD_HASH = fakePasswordHasher().hash(OWNER_PASSWORD);

export const SETUP_CODE = '4821-7730';

export const PHONE_ADDRESS = '203.0.113.24';

export const LAPTOP_ADDRESS = '198.51.100.7';

export const THIS_MACHINE = '127.0.0.1';

export const LOCAL_ORIGIN = 'http://localhost:3000';

export const PUBLIC_ORIGIN = 'https://autoveille.example.fr';

export interface AuthenticationFakes {
  readonly secrets: FakeSecretStore;
  readonly sessions: FakeSessionRepository;
  readonly clock: FakeClock;
  readonly random: Random;
  readonly passwordHasher: PasswordHasher;
  readonly attempts: AttemptLimiter;
}

export const authenticationFakes = (secrets: Parameters<typeof fakeSecretStore>[0] = {}): AuthenticationFakes => {
  const clock = fakeClock();
  return {
    secrets: fakeSecretStore(secrets),
    sessions: fakeSessionRepository(),
    clock,
    random: fakeRandom(),
    passwordHasher: fakePasswordHasher(),
    attempts: createAttemptLimiter(clock),
  };
};

export const refusalOf = (attempt: () => unknown): AuthenticationProblem | undefined => {
  try {
    attempt();
    return undefined;
  } catch (error) {
    if (error instanceof AuthenticationRefused) {
      return error.problem;
    }
    throw error;
  }
};
