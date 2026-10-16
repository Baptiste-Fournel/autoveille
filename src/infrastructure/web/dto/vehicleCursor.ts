import { Buffer } from 'node:buffer';
import type { VehicleCursor } from '../../../application/ports/vehicleRepository.js';

const CURSOR_ENCODING = 'base64url';

export class UnreadableCursor extends Error {
  constructor(cursor: string) {
    super(cursor);
    this.name = 'UnreadableCursor';
  }
}

export const cursorText = (cursor: VehicleCursor): string =>
  Buffer.from(JSON.stringify({ sortAt: cursor.sortAt, id: cursor.id })).toString(CURSOR_ENCODING);

const decoded = (cursor: string): unknown => {
  try {
    return JSON.parse(Buffer.from(cursor, CURSOR_ENCODING).toString());
  } catch {
    return undefined;
  }
};

const isVehicleCursor = (value: unknown): value is VehicleCursor =>
  typeof value === 'object' &&
  value !== null &&
  'sortAt' in value &&
  typeof value.sortAt === 'string' &&
  'id' in value &&
  Number.isSafeInteger(value.id);

export const vehicleCursorOf = (cursor: string): VehicleCursor => {
  const value = decoded(cursor);
  if (!isVehicleCursor(value)) {
    throw new UnreadableCursor(cursor);
  }
  return { sortAt: value.sortAt, id: value.id };
};
