import { isRecord } from '../guards/isRecord';

export interface PushNotification {
  readonly title: string;
  readonly options: NotificationOptions;
}

const DEFAULT_TITLE = 'AutoVeille';

const DEFAULT_BODY = 'Nouvelle annonce';

const DEFAULT_ADDRESS = '/';

const NOTIFICATION_ICON = '/icons/icon-192.png';

const NOTIFICATION_BADGE = '/icons/badge-72.png';

const textIn = (payload: unknown, name: string, fallback: string): string => {
  const value = isRecord(payload) ? payload[name] : undefined;
  return typeof value === 'string' ? value : fallback;
};

const readOrNothing = (read: () => unknown): unknown => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

const vehicleTagOf = (payload: unknown): string | undefined => {
  const vehicleId = isRecord(payload) ? payload.vehicleId : undefined;
  return (typeof vehicleId === 'number' || typeof vehicleId === 'string') && vehicleId ? `vehicle-${vehicleId}` : undefined;
};

export const notificationFromPush = (readPayload: () => unknown): PushNotification => {
  const payload = readOrNothing(readPayload);
  return {
    title: textIn(payload, 'title', DEFAULT_TITLE),
    options: {
      body: textIn(payload, 'body', DEFAULT_BODY),
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      tag: vehicleTagOf(payload),
      data: { url: textIn(payload, 'url', DEFAULT_ADDRESS) },
    },
  };
};

export const clickedAddress = (data: unknown): string => textIn(data, 'url', '') || DEFAULT_ADDRESS;
