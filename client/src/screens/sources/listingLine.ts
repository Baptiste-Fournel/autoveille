import type { EmailListingDto, SampleListingDto } from '../../../../src/shared/api';
import { formatInteger } from '../../format/integer';

const priceAndKm = (listing: SampleListingDto | EmailListingDto): string =>
  `${listing.price ? `, ${formatInteger(listing.price)} €` : ''}${listing.km ? `, ${formatInteger(listing.km)} km` : ''}`;

export const sampleListingLine = (listing: SampleListingDto): string =>
  `${listing.title}${priceAndKm(listing)}${listing.city ? `, ${listing.city}` : ''}`;

export const emailListingLine = (listing: EmailListingDto): string =>
  `${listing.title}${priceAndKm(listing)}${listing.year ? `, ${listing.year}` : ''}${listing.city ? `, ${listing.city}` : ''}${listing.sellerType === 'pro' ? ' (pro)' : ''}`;
