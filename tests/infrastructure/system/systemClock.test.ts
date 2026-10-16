import { afterEach, describe, expect, it, vi } from 'vitest';
import { systemClock } from '../../../src/infrastructure/system/systemClock.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('horloge du serveur', () => {
  it('à minuit et demie, « aujourd’hui » commence à minuit à l’heure du serveur, et l’instant est écrit en ISO 8601', () => {
    // Given
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 0, 30, 15, 250));

    // When
    const now = systemClock.now();
    const startOfToday = systemClock.startOfToday();

    // Then
    expect(now).toBe(new Date(2026, 9, 16, 0, 30, 15, 250).toISOString());
    expect(startOfToday).toBe(new Date(2026, 9, 16, 0, 0, 0, 0).toISOString());
  });
});
