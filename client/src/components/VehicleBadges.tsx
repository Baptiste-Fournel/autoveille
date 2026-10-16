import type { JSX } from 'preact';
import type { VehicleDto } from '../../../src/shared/api';
import { useAppState } from '../app/AppContext';
import { shownDate } from '../format/vehicleDate';

const FRESH_FOR_MS = 86_400_000;

const isFresh = (vehicle: VehicleDto, now: number): boolean => now - new Date(shownDate(vehicle)).getTime() < FRESH_FOR_MS;

const badgesOf = (vehicle: VehicleDto, now: number): readonly JSX.Element[] =>
  [
    vehicle.status === 'nouveau' && vehicle.matched && isFresh(vehicle, now) ? (
      <span key="new" class="badge new">
        Nouveau
      </span>
    ) : null,
    vehicle.priceDropped ? (
      <span key="price" class="badge ok">
        Prix baissé
      </span>
    ) : null,
    vehicle.reposted ? (
      <span key="reposted" class="badge">
        Republiée
      </span>
    ) : null,
    vehicle.listings.length > 1 ? (
      <span key="elsewhere" class="badge">
        {`Aussi sur ${vehicle.listings
          .slice(1)
          .map((listing) => listing.siteLabel)
          .join(', ')}`}
      </span>
    ) : null,
    vehicle.specialReason ? (
      <span key="special" class="badge" title="Pourquoi cette annonce est retenue">
        {`Retenue : ${vehicle.specialReason}`}
      </span>
    ) : null,
    vehicle.sellerType === 'pro' ? (
      <span key="pro" class="badge warn">
        Vendeur pro
      </span>
    ) : null,
    vehicle.doNotContact ? (
      <span key="doNotContact" class="badge warn">
        Ne plus contacter
      </span>
    ) : null,
    vehicle.messageEdited ? (
      <span key="edited" class="badge">
        Message modifié
      </span>
    ) : null,
  ].filter((badge): badge is JSX.Element => badge !== null);

export const VehicleBadges = ({ vehicle }: { readonly vehicle: VehicleDto }): JSX.Element | null => {
  const { refresh } = useAppState();
  const badges = badgesOf(vehicle, refresh.now.value);
  return badges.length ? <div class="badges">{badges}</div> : null;
};
