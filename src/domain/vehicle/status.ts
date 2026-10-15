import type { VehicleChanges } from './changes.js';
import { EVENT_TYPES, type NewVehicleEvent, type VehicleEventType } from './events.js';
import type { Status, Vehicle } from './types.js';

const STATUSES: readonly Status[] = ['nouveau', 'contacte', 'repondu', 'ignore'];

const STATUS_EVENTS: Readonly<Record<Status, VehicleEventType>> = {
  nouveau: EVENT_TYPES.markedNew,
  contacte: EVENT_TYPES.markedContacted,
  repondu: EVENT_TYPES.markedReplied,
  ignore: EVENT_TYPES.markedIgnored,
};

const NOTE_MAX_LENGTH = 2000;

export interface VehicleUpdateRequest {
  readonly status?: string;
  readonly doNotContact?: boolean;
  readonly message?: string | null;
  readonly keep?: boolean;
  readonly note?: string | null;
}

export interface VehicleUpdate {
  readonly changes: VehicleChanges;
  readonly eventsToErase: readonly VehicleEventType[];
  readonly eventsToAdd: readonly NewVehicleEvent[];
}

export class UnknownStatus extends Error {
  readonly status: string;

  constructor(status: string) {
    super(status);
    this.name = 'UnknownStatus';
    this.status = status;
  }
}

const isStatus = (value: string): value is Status => STATUSES.some((status) => status === value);

export const isAwaitingDecision = (vehicle: Pick<Vehicle, 'status' | 'doNotContact'>): boolean =>
  vehicle.status === 'nouveau' && !vehicle.doNotContact;

const eventsErasedGoingBackTo = (target: Status, current: Status): readonly VehicleEventType[] => {
  if (target === 'nouveau') {
    return [EVENT_TYPES.markedContacted, EVENT_TYPES.markedReplied];
  }
  return target === 'contacte' && current === 'repondu' ? [EVENT_TYPES.markedReplied] : [];
};

const NO_UPDATE: VehicleUpdate = { changes: {}, eventsToErase: [], eventsToAdd: [] };

const eventAt = (type: VehicleEventType, at: string): NewVehicleEvent => ({ type, detail: null, at });

const statusStep = (target: Status, current: Status, at: string): VehicleUpdate => ({
  changes: { status: target },
  eventsToErase: eventsErasedGoingBackTo(target, current),
  eventsToAdd: [eventAt(STATUS_EVENTS[target], at)],
});

const doNotContactStep = (doNotContact: boolean, at: string): VehicleUpdate =>
  doNotContact
    ? { changes: { doNotContact: true, status: 'ignore' }, eventsToErase: [], eventsToAdd: [eventAt(EVENT_TYPES.doNotContact, at)] }
    : { ...NO_UPDATE, changes: { doNotContact: false } };

const messageStep = (message: string | null): VehicleUpdate => ({
  ...NO_UPDATE,
  changes: { messageOverride: message?.trim() ? message : null },
});

const noteStep = (note: string | null): VehicleUpdate => ({
  ...NO_UPDATE,
  changes: { note: note && String(note).trim() ? String(note).slice(0, NOTE_MAX_LENGTH) : null },
});

const keepStep = (at: string): VehicleUpdate => ({
  changes: { matched: true, rejections: [] },
  eventsToErase: [],
  eventsToAdd: [eventAt(EVENT_TYPES.keptAnyway, at)],
});

const combined = (steps: readonly VehicleUpdate[]): VehicleUpdate =>
  steps.reduce(
    (all, step) => ({
      changes: { ...all.changes, ...step.changes },
      eventsToErase: [...all.eventsToErase, ...step.eventsToErase],
      eventsToAdd: [...all.eventsToAdd, ...step.eventsToAdd],
    }),
    NO_UPDATE,
  );

export function planVehicleUpdate(
  vehicle: Pick<Vehicle, 'status'>,
  request: VehicleUpdateRequest,
  now: string,
): VehicleUpdate | UnknownStatus {
  const { status, doNotContact, message, keep, note } = request;
  if (status !== undefined && !isStatus(status)) {
    return new UnknownStatus(status);
  }
  return combined([
    status === undefined ? NO_UPDATE : statusStep(status, vehicle.status, now),
    doNotContact === undefined ? NO_UPDATE : doNotContactStep(doNotContact, now),
    message === undefined ? NO_UPDATE : messageStep(message),
    note === undefined ? NO_UPDATE : noteStep(note),
    keep ? keepStep(now) : NO_UPDATE,
  ]);
}
