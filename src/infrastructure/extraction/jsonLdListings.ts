import { load } from 'cheerio';
import { parseLocation } from '../../domain/parsing/location.js';
import { parsePrice } from '../../domain/parsing/price.js';
import { cleanText } from '../../domain/parsing/text.js';
import { parseYear } from '../../domain/parsing/year.js';
import { listingRef } from '../../domain/sites/listingUrl.js';
import type { RawListing, SellerType } from '../../domain/vehicle/types.js';
import { adDescription } from './adDescription.js';

type JsonLdNode = Readonly<Record<string, unknown>>;

const NESTED_NODE_KEYS = ['@graph', 'itemListElement', 'item', 'mainEntity', 'offers'];

const VEHICLE_TYPES = ['car', 'vehicle', 'product', 'motorcycle'];

const PROFESSIONAL_SELLER_TYPE = /organization|autodealer|localbusiness/i;

const isJsonLdNode = (value: unknown): value is JsonLdNode => typeof value === 'object' && value !== null;

const propertyOf = (value: unknown, key: string): unknown => (isJsonLdNode(value) ? value[key] : undefined);

const asArray = (value: unknown): readonly unknown[] => {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const nodesOf = (value: unknown): readonly JsonLdNode[] => {
  if (Array.isArray(value)) {
    return value.flatMap(nodesOf);
  }
  if (!isJsonLdNode(value)) {
    return [];
  }
  return [value, ...NESTED_NODE_KEYS.flatMap((key) => (value[key] ? nodesOf(value[key]) : []))];
};

const isVehicle = (node: JsonLdNode): boolean =>
  asArray(node['@type'])
    .map((type) => String(type).toLowerCase())
    .some((type) => VEHICLE_TYPES.includes(type));

const priceOf = (node: JsonLdNode, offers: readonly unknown[]): number | undefined => {
  const price = offers.map((offer) => propertyOf(offer, 'price')).find((value) => value !== undefined) ?? node.price;
  return price !== undefined ? (parsePrice(`${String(price)} €`) ?? (Number(price) || undefined)) : undefined;
};

const kmOf = (node: JsonLdNode): number | undefined => {
  const odometer = node.mileageFromOdometer;
  const km =
    typeof odometer === 'object' && odometer
      ? Number(propertyOf(odometer, 'value'))
      : odometer !== undefined
        ? Number(odometer)
        : undefined;
  return km && Number.isFinite(km) ? km : undefined;
};

const modelYearOf = (node: JsonLdNode, maxYear: number): number | undefined => {
  const year = node.vehicleModelDate ?? node.productionDate ?? node.modelDate ?? node.releaseDate;
  return year ? parseYear(String(year), maxYear) : undefined;
};

const sellerTypeOf = (offers: readonly unknown[]): SellerType | undefined => {
  const seller = offers.map((offer) => propertyOf(offer, 'seller')).find(Boolean);
  if (!seller) {
    return undefined;
  }
  return asArray(propertyOf(seller, '@type')).some((type) => PROFESSIONAL_SELLER_TYPE.test(String(type))) ? 'pro' : 'particulier';
};

const areaOf = (offers: readonly unknown[]): string => {
  const area = offers.map((offer) => propertyOf(offer, 'areaServed') ?? propertyOf(offer, 'availableAtOrFrom')).find(Boolean);
  return typeof area === 'string' ? area : JSON.stringify(area ?? '');
};

const imageOf = (node: JsonLdNode): string | undefined => {
  const image = asArray(node.image)[0];
  if (typeof image === 'string') {
    return image;
  }
  return typeof image === 'object' && image ? String(propertyOf(image, 'url') ?? '') || undefined : undefined;
};

const listingOfNode = (node: JsonLdNode, pageUrl: string, maxYear: number): RawListing | undefined => {
  const name = cleanText(String(node.name ?? ''));
  const url = typeof node.url === 'string' ? new URL(node.url, pageUrl).toString() : undefined;
  if (!name || !url) {
    return undefined;
  }
  const ref = listingRef(url);
  if (!ref) {
    return undefined;
  }
  const offers = asArray(node.offers);
  const location = parseLocation(areaOf(offers));
  return {
    site: ref.site,
    siteLabel: ref.siteLabel,
    externalId: ref.id,
    url: ref.url,
    title: name,
    price: priceOf(node, offers),
    km: kmOf(node),
    year: modelYearOf(node, maxYear),
    city: location.city,
    postalCode: location.postalCode,
    sellerType: sellerTypeOf(offers),
    imageUrl: imageOf(node),
    description: adDescription(cleanText(String(node.description ?? ''))) || undefined,
  };
};

export const jsonLdListings = (html: string, pageUrl: string, maxYear: number): readonly RawListing[] => {
  const $ = load(html);
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script) => nodesOf(parsedJson($(script).text())))
    .filter(isVehicle)
    .map((node) => listingOfNode(node, pageUrl, maxYear))
    .filter((listing) => listing !== undefined);
};
