export type Family = 'allemandes' | 'italiennes' | 'americaines' | 'francaises' | 'autres';
export const FAMILIES: Family[] = ['allemandes', 'italiennes', 'americaines', 'francaises'];
export const FAMILY_LABELS: Record<Family, string> = {
  allemandes: 'Allemandes',
  italiennes: 'Italiennes',
  americaines: 'Américaines',
  francaises: 'Françaises',
  autres: 'Autres',
};

export type SellerType = 'particulier' | 'pro' | 'inconnu';
export type Status = 'nouveau' | 'contacte' | 'repondu' | 'ignore';

/** What a source (email alert, HTTP page) produces, before normalization. */
export interface RawListing {
  site: string;
  siteLabel: string;
  externalId: string;
  url: string;
  title: string;
  price?: number;
  km?: number;
  year?: number;
  city?: string;
  postalCode?: string;
  sellerType?: SellerType;
  description?: string;
  imageUrl?: string;
  publishedAt?: string;
  sourceRef?: string;
}

/** Vehicle identity extracted from a raw listing. */
export interface VehicleInfo {
  make?: string;
  model?: string;
  family: Family;
  year?: number;
  km?: number;
  price?: number;
}

export interface FamilyRules {
  enabled: boolean;
  /** Brands shown as chips; `brands` are the enabled ones, `known` the full editable list. */
  brands: string[];
  known: string[];
  /** "Supercar & collection" rule: pass when price >= minPrice OR year <= maxYear OR a keyword matches. */
  minPrice: number;
  maxYear: number;
  keywords: string[];
}

export interface MessageTemplate {
  /** Several openings, one is picked per vehicle so the same text is not sent to everyone. */
  variants: string[];
}

export interface Settings {
  dealer: { firstName: string; lastName: string; company: string; city: string; phone: string };
  zone: { city: string; postalCode: string; lat: number | null; lon: number | null; radiusKm: number };
  maxKm: number;
  privateOnly: boolean;
  specialOnly: boolean;
  families: Record<Family, FamilyRules>;
  templates: Record<Family, MessageTemplate>;
  notifications: { push: boolean; telegramToken: string; telegramChatId: string };
  /** The dedicated mailbox that receives the sites' alert emails. */
  imap: { host: string; port: number; user: string; pass: string; mailbox: string };
  httpSites: Array<{ id: string; name: string; url: string; enabled: boolean }>;
  /** Sites on which the person has created the alert, so every device shows the same checklist. */
  alertsDone: Record<string, boolean>;
}

export interface FilterResult {
  pass: boolean;
  /** Human-readable reasons in French, for the UI ("hors zone", "kilométrage trop élevé", ...). */
  reasons: string[];
  distanceKm?: number | null;
}
