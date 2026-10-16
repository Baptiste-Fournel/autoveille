import type { Status, VehicleDto, VehicleUpdateRequest } from '../../../src/shared/api';

const NOTE_MAX_LENGTH = 2000;

const STATUSES: readonly Status[] = ['nouveau', 'contacte', 'repondu', 'ignore'];

const statusIn = (value: string | undefined): Status | undefined => STATUSES.find((status) => status === value);

const withStatus = (vehicle: VehicleDto, status: Status | undefined, at: string): VehicleDto => {
  switch (status) {
    case undefined:
      return vehicle;
    case 'nouveau':
      return { ...vehicle, status, contactedAt: null, repliedAt: null };
    case 'contacte':
      return { ...vehicle, status, contactedAt: at, repliedAt: null };
    case 'repondu':
      return { ...vehicle, status, repliedAt: at };
    default:
      return { ...vehicle, status, contactedAt: null, repliedAt: null };
  }
};

const withDoNotContact = (vehicle: VehicleDto, doNotContact: boolean | undefined): VehicleDto =>
  doNotContact === undefined ? vehicle : { ...vehicle, doNotContact };

const targetStatus = (change: VehicleUpdateRequest): Status | undefined =>
  change.doNotContact === true ? 'ignore' : statusIn(change.status);

const withMessage = (vehicle: VehicleDto, message: string | null | undefined): VehicleDto => {
  if (message === undefined) {
    return vehicle;
  }
  return message?.trim() ? { ...vehicle, message, messageEdited: true } : { ...vehicle, messageEdited: false };
};

const withNote = (vehicle: VehicleDto, note: string | null | undefined): VehicleDto => {
  if (note === undefined) {
    return vehicle;
  }
  return { ...vehicle, note: note?.trim() ? note.slice(0, NOTE_MAX_LENGTH) : '' };
};

const withKeep = (vehicle: VehicleDto, keep: boolean | undefined): VehicleDto =>
  keep ? { ...vehicle, matched: true, reasons: [] } : vehicle;

export const predictedVehicle = (vehicle: VehicleDto, change: VehicleUpdateRequest, now: number): VehicleDto => {
  const at = new Date(now).toISOString();
  const statusChanged = withStatus(vehicle, targetStatus(change), at);
  return withKeep(withNote(withMessage(withDoNotContact(statusChanged, change.doNotContact), change.message), change.note), change.keep);
};

export const undoOf = (vehicle: Pick<VehicleDto, 'status'>, change: VehicleUpdateRequest): VehicleUpdateRequest | null =>
  change.status || change.doNotContact ? { status: vehicle.status, ...(change.doNotContact ? { doNotContact: false } : {}) } : null;
