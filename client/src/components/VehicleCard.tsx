import type { ComponentChildren, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { VehicleDto } from '../../../src/shared/api';
import { useAppState } from '../app/AppContext';
import { followUpText } from '../format/followUp';
import { whenText } from '../format/vehicleDate';
import { locationText } from '../format/vehicleLocation';
import { Icon } from './Icon';
import { MessageField } from './MessageField';
import { VehicleActions } from './VehicleActions';
import { VehicleBadges } from './VehicleBadges';
import { VehicleSpecs } from './VehicleSpecs';

const NO_PHOTO_TITLE = 'Le site n’a pas transmis de photo : elle est sur l’annonce.';

const Thumbnail = ({ vehicle }: { readonly vehicle: VehicleDto }): JSX.Element => {
  const [broken, setBroken] = useState(false);
  if (!vehicle.imageUrl || broken) {
    return (
      <div class="thumb empty" title={NO_PHOTO_TITLE}>
        <Icon name="car" />
        <span>photo sur le site</span>
      </div>
    );
  }
  return <img class="thumb" src={vehicle.imageUrl} alt="" loading="lazy" referrerpolicy="no-referrer" onError={() => setBroken(true)} />;
};

const SheetLink = ({ vehicle, children }: { readonly vehicle: VehicleDto; readonly children: ComponentChildren }): JSX.Element => (
  <a class="plain" href={`#/annonce/${vehicle.id}`} aria-label={`Voir la fiche : ${vehicle.name}`}>
    {children}
  </a>
);

export const VehicleCard = ({ vehicle }: { readonly vehicle: VehicleDto }): JSX.Element => {
  const { refresh } = useAppState();
  const now = refresh.now.value;
  const message = useRef<HTMLTextAreaElement>(null);
  const followUp = followUpText(vehicle, now);
  return (
    <article class="card listing" id={`v-${vehicle.id}`}>
      <div class="head">
        <SheetLink vehicle={vehicle}>
          <Thumbnail key={vehicle.imageUrl} vehicle={vehicle} />
        </SheetLink>
        <div class="title">
          <h3 title={vehicle.title}>
            <SheetLink vehicle={vehicle}>{vehicle.name}</SheetLink>
          </h3>
          <span class="sub">{vehicle.title !== vehicle.name ? vehicle.title : ''}</span>
          <span class="sub">{[locationText(vehicle), vehicle.siteLabel, whenText(vehicle, now)].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      <VehicleSpecs vehicle={vehicle} />
      <VehicleBadges vehicle={vehicle} />
      {followUp ? <p class="follow">{followUp}</p> : null}
      {vehicle.note ? (
        <p class="vnote">
          <Icon name="pen" />
          <span>{vehicle.note}</span>
        </p>
      ) : null}
      {vehicle.matched && vehicle.status === 'nouveau' ? <MessageField vehicle={vehicle} folded textareaRef={message} /> : null}
      <VehicleActions vehicle={vehicle} messageText={() => message.current?.value ?? vehicle.message} primaryPlacement="first" />
    </article>
  );
};
