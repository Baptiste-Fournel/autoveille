import type { VehicleCard } from '../../../application/vehicles/vehicleCard.js';
import type { VehicleSheet } from '../../../application/vehicles/vehicleSheet.js';
import { FAMILY_LABELS } from '../../../domain/presentation/familyLabels.js';
import { describeRejection } from '../../../domain/presentation/reasons.js';
import { describeSpecialReason } from '../../../domain/presentation/specialReasons.js';
import type { Listing, PricePoint, VehicleEvent } from '../../../domain/vehicle/types.js';
import { vehicleName } from '../../../domain/vehicle/vehicleName.js';
import type { ListingDto, PricePointDto, VehicleDto, VehicleEventDto } from '../../../shared/api.js';

type PriceHistoryOf = (listing: Listing) => readonly PricePoint[];

const WITHOUT_PRICE_HISTORY: PriceHistoryOf = () => [];

const pricePointDto = (point: PricePoint): PricePointDto => ({ price: point.price, seen_at: point.seenAt });

const eventDto = (event: VehicleEvent): VehicleEventDto => ({
  id: event.id,
  vehicle_id: event.vehicleId,
  type: event.type,
  detail: event.detail,
  at: event.at,
});

const listingDto = (listing: Listing, priceHistory: readonly PricePoint[]): ListingDto => ({
  id: listing.id,
  site: listing.site,
  siteLabel: listing.siteLabel,
  url: listing.url,
  title: listing.title,
  price: listing.price,
  firstSeenAt: listing.firstSeenAt,
  lastSeenAt: listing.lastSeenAt,
  priceHistory: priceHistory.map(pricePointDto),
});

const vehicleDto = (card: VehicleCard, priceHistoryOf: PriceHistoryOf, events: readonly VehicleEvent[]): VehicleDto => {
  const { vehicle, listings, showcase } = card;
  const firstListing = listings[0];
  return {
    id: vehicle.id,
    name: vehicleName(vehicle, firstListing?.title ?? ''),
    title: firstListing?.title ?? '',
    make: vehicle.make,
    model: vehicle.model,
    family: vehicle.family,
    familyLabel: FAMILY_LABELS[vehicle.family],
    year: vehicle.year,
    km: vehicle.km,
    price: vehicle.price,
    city: vehicle.city,
    postalCode: vehicle.postalCode,
    distanceKm: vehicle.distanceKm === null ? null : Math.round(vehicle.distanceKm),
    status: vehicle.status,
    doNotContact: vehicle.doNotContact,
    matched: vehicle.matched,
    reasons: vehicle.rejections.map(describeRejection),
    specialReason: card.specialReason === undefined ? null : describeSpecialReason(card.specialReason),
    priceDropped: vehicle.priceDropped,
    reposted: vehicle.reposted,
    firstSeenAt: vehicle.firstSeenAt,
    lastSeenAt: vehicle.lastSeenAt,
    publishedAt: showcase.publishedAt,
    url: firstListing?.url ?? '',
    site: firstListing?.site ?? '',
    siteLabel: firstListing?.siteLabel ?? '',
    imageUrl: showcase.imageUrl,
    description: showcase.description,
    sellerType: firstListing?.sellerType ?? 'inconnu',
    message: card.message,
    messageEdited: Boolean(vehicle.messageOverride),
    note: vehicle.note ?? '',
    contactedAt: card.contactedAt,
    repliedAt: card.repliedAt,
    listings: listings.map((listing) => listingDto(listing, priceHistoryOf(listing))),
    events: events.map(eventDto),
  };
};

export const vehicleCardDto = (card: VehicleCard): VehicleDto => vehicleDto(card, WITHOUT_PRICE_HISTORY, []);

export const vehicleSheetDto = (sheet: VehicleSheet): VehicleDto =>
  vehicleDto(sheet, (listing) => sheet.priceHistories.get(listing.id) ?? [], sheet.events);
