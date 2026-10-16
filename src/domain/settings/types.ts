import type { Family } from '../catalog/families.js';

export interface FamilyRules {
  readonly enabled: boolean;
  readonly brands: readonly string[];
  readonly known: readonly string[];
  readonly minPrice: number;
  readonly maxYear: number;
  readonly keywords: readonly string[];
}

export interface MessageTemplate {
  readonly variants: readonly string[];
}

export interface Dealer {
  readonly firstName: string;
  readonly lastName: string;
  readonly company: string;
  readonly city: string;
  readonly phone: string;
}

export interface Zone {
  readonly city: string;
  readonly postalCode: string;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly radiusKm: number;
}

export interface NotificationSettings {
  readonly push: boolean;
  readonly telegramToken: string;
  readonly telegramChatId: string;
}

export interface MailboxSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly pass: string;
  readonly mailbox: string;
}

export interface HttpSite {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly enabled: boolean;
}

export type AlertSellerType = 'particulier' | 'pro' | 'tous';

export interface AlertInfo {
  readonly site: string;
  readonly criteria: string;
  readonly confirmedAt: string;
  readonly manageUrl?: string;
  readonly radiusKm?: number;
  readonly maxKm?: number;
  readonly postalCode?: string;
  readonly sellerType?: AlertSellerType;
}

export interface Settings {
  readonly dealer: Dealer;
  readonly zone: Zone;
  readonly maxKm: number;
  readonly privateOnly: boolean;
  readonly specialOnly: boolean;
  readonly families: Readonly<Record<Family, FamilyRules>>;
  readonly templates: Readonly<Record<Family, MessageTemplate>>;
  readonly notifications: NotificationSettings;
  readonly imap: MailboxSettings;
  readonly httpSites: readonly HttpSite[];
  readonly alertsDone: Readonly<Record<string, boolean>>;
  readonly alerts: Readonly<Record<string, AlertInfo>>;
}
