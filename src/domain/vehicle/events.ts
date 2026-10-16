export const EVENT_TYPES = {
  firstSeen: 'nouveau',
  priceDropped: 'prix_baisse',
  priceRaised: 'prix_hausse',
  repostedOnSameSite: 'republiee',
  seenOnAnotherSite: 'autre_site',
  notificationFailed: 'notification_echec',
  markedNew: 'statut_nouveau',
  markedContacted: 'statut_contacte',
  markedReplied: 'statut_repondu',
  markedIgnored: 'statut_ignore',
  doNotContact: 'ne_plus_contacter',
  keptAnyway: 'garde_manuellement',
} as const;

export type VehicleEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface NewVehicleEvent {
  readonly type: VehicleEventType;
  readonly detail: string | null;
  readonly at: string;
}

export const priceChangeDetail = (from: number, to: number): string => `${from} → ${to}`;

export const sightingDetail = (siteLabel: string, url: string): string => `${siteLabel} ${url}`;
