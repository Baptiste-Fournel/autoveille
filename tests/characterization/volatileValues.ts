import { CHARACTERIZATION_DAYS } from './clock.js';

const ISO_INSTANT = /(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}((?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))/g;
const IMPORT_TOKEN = /^[0-9a-f]{48}$/;
const VAPID_PUBLIC_KEY = /^B[A-Za-z0-9_-]{86}$/;
const CLOCK_READ_WINDOW = 6 * 3_600_000;

const readOnFrozenClock = (iso: string): boolean => {
  const instant = Date.parse(iso);
  return CHARACTERIZATION_DAYS.some((start) => instant >= start && instant < start + CLOCK_READ_WINDOW);
};

const withClockTimeHidden = (iso: string, day: string, suffix: string): string =>
  readOnFrozenClock(iso) ? `${day}T<heure>${suffix}` : iso;

function normalizeText(text: string): string {
  if (IMPORT_TOKEN.test(text)) return '<token>';
  if (VAPID_PUBLIC_KEY.test(text)) return '<vapid-public-key>';
  return text.replace(ISO_INSTANT, withClockTimeHidden);
}

export function withoutVolatileValues(value: unknown): unknown {
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) return value.map((item: unknown) => withoutVolatileValues(item));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]: [string, unknown]) => [key, withoutVolatileValues(item)]));
  }
  return value;
}
