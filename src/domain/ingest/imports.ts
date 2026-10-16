import { siteLabel } from '../sites/catalog.js';
import { isWebAddress } from '../sites/webAddress.js';
import { daysAfter } from '../time/daysAfter.js';
import type { RawListing, SellerType } from '../vehicle/types.js';

export type ImportedListing = { readonly [Field in keyof RawListing]?: unknown };

export interface ImportedPublicationDate {
  readonly site?: unknown;
  readonly externalId?: unknown;
  readonly publishedAt?: unknown;
}

export interface PublicationDate {
  readonly site: string;
  readonly externalId: string;
  readonly publishedAt: string;
}

const MAX_LENGTH = {
  site: 40,
  siteLabel: 60,
  externalId: 300,
  url: 1000,
  title: 300,
  city: 120,
  postalCode: 10,
  imageUrl: 1000,
  description: 4000,
} as const;

const PUBLICATION_DATE_TOLERANCE_DAYS = 1;

const textOf = (value: unknown, maxLength: number): string => String(value ?? '').slice(0, maxLength);

const optionalTextOf = (value: unknown, maxLength: number): string | undefined => (value ? String(value).slice(0, maxLength) : undefined);

const positiveWholeNumber = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
};

const webAddressOf = (value: unknown): string | undefined =>
  value && isWebAddress(String(value)) ? String(value).slice(0, MAX_LENGTH.imageUrl) : undefined;

const sellerTypeOf = (value: unknown): SellerType | undefined => (value === 'pro' || value === 'particulier' ? value : undefined);

const instantOf = (value: unknown): string | undefined =>
  value && !Number.isNaN(Date.parse(String(value))) ? new Date(String(value)).toISOString() : undefined;

export function listingFromImport(item: ImportedListing): RawListing | undefined {
  const site = textOf(item.site, MAX_LENGTH.site);
  const url = textOf(item.url, MAX_LENGTH.url);
  const title = String(item.title ?? '')
    .trim()
    .slice(0, MAX_LENGTH.title);
  if (!site || !isWebAddress(url) || !title) {
    return undefined;
  }
  return {
    site,
    siteLabel: String(item.siteLabel ?? siteLabel(site)).slice(0, MAX_LENGTH.siteLabel),
    externalId: String(item.externalId ?? url).slice(0, MAX_LENGTH.externalId),
    url,
    title,
    price: positiveWholeNumber(item.price),
    km: positiveWholeNumber(item.km),
    year: positiveWholeNumber(item.year),
    city: optionalTextOf(item.city, MAX_LENGTH.city),
    postalCode: optionalTextOf(item.postalCode, MAX_LENGTH.postalCode),
    imageUrl: webAddressOf(item.imageUrl),
    description: optionalTextOf(item.description, MAX_LENGTH.description),
    sellerType: sellerTypeOf(item.sellerType),
    publishedAt: instantOf(item.publishedAt),
  };
}

export function publicationDateFromImport(item: ImportedPublicationDate, now: string): PublicationDate | undefined {
  const site = textOf(item.site, MAX_LENGTH.site);
  const externalId = textOf(item.externalId, MAX_LENGTH.externalId);
  const publishedAt = Date.parse(String(item.publishedAt ?? ''));
  if (!site || !externalId || Number.isNaN(publishedAt) || publishedAt > Date.parse(daysAfter(now, PUBLICATION_DATE_TOLERANCE_DAYS))) {
    return undefined;
  }
  return { site, externalId, publishedAt: new Date(publishedAt).toISOString() };
}
