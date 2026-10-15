import {
  type NotificationText,
  newVehicleText,
  priceDropText,
  truncatedDigestText,
} from '../../domain/presentation/listingNotifications.js';
import type { RawListing, Vehicle } from '../../domain/vehicle/types.js';
import type { PushNotification } from '../ports/notificationChannel.js';

export interface NotificationMessages {
  readonly push: PushNotification;
  readonly telegram: string;
}

export interface TruncatedDigestNotice {
  readonly siteLabel: string;
  readonly announced: number;
  readonly received: number;
  readonly moreUrl?: string;
}

const SOURCES_SCREEN = '/#/sources';

const vehicleScreen = (vehicleId: number): string => `/#/annonce/${vehicleId}`;

const aboutVehicle = (text: NotificationText, vehicleId: number, baseUrl: string): NotificationMessages => {
  const url = `${baseUrl}${vehicleScreen(vehicleId)}`;
  return {
    push: { title: text.title, body: text.body, url, vehicleId },
    telegram: `${text.title}\n${text.body}\n${url}`,
  };
};

export const newVehicleNotification = (vehicle: Vehicle, listing: RawListing, baseUrl: string): NotificationMessages =>
  aboutVehicle(newVehicleText(vehicle, listing), vehicle.id, baseUrl);

export const priceDropNotification = (
  vehicle: Vehicle,
  listing: RawListing,
  from: number,
  to: number,
  baseUrl: string,
): NotificationMessages => aboutVehicle(priceDropText(vehicle, listing, from, to), vehicle.id, baseUrl);

export const truncatedDigestNotification = (notice: TruncatedDigestNotice, baseUrl: string): NotificationMessages => {
  const { title, body } = truncatedDigestText(notice.siteLabel, notice.announced, notice.received);
  return {
    push: { title, body, url: `${baseUrl}${SOURCES_SCREEN}` },
    telegram: `${title}\n${body}${notice.moreUrl ? `\n${notice.moreUrl}` : ''}`,
  };
};
