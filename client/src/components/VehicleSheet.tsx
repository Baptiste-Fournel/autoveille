import { Fragment, type JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { VehicleDto, VehicleUpdateRequest } from '../../../src/shared/api';
import { useAppState } from '../app/AppContext';
import { followUpText } from '../format/followUp';
import { whenText } from '../format/vehicleDate';
import { locationText } from '../format/vehicleLocation';
import { Icon } from './Icon';
import { MessageField } from './MessageField';
import { NoteField } from './NoteField';
import { type BurstControls, VehicleActions } from './VehicleActions';
import { VehicleBadges } from './VehicleBadges';
import { VehicleSpecs } from './VehicleSpecs';

const PHOTOS_ON_SITE_TEXT = 'Photos sur le site';

const NO_PHOTO_TEXT = 'Le site n’a pas transmis de photo — voir sur l’annonce';

const NO_PUBLICATION_DATE_TITLE =
  'Ce site n’indique pas la date de publication dans ses listes ni dans ses alertes : la date affichée est celle de l’arrivée dans l’application.';

export interface VehicleSheetProps {
  readonly vehicle: VehicleDto;
  readonly burst?: BurstControls;
  readonly onActed?: (change: VehicleUpdateRequest) => void;
  readonly onUndone?: (change: VehicleUpdateRequest) => void;
  readonly onMessageSaved?: (saved: VehicleDto) => void;
}

const PhotoOnSite = ({ url, text }: { readonly url: string; readonly text: string }): JSX.Element => (
  <a class="photo empty" href={url} target="_blank" rel="noopener" title={PHOTOS_ON_SITE_TEXT}>
    <Icon name="car" />
    <span class="muted small">{text}</span>
  </a>
);

const Photo = ({ vehicle }: { readonly vehicle: VehicleDto }): JSX.Element => {
  const [broken, setBroken] = useState(false);
  if (!vehicle.imageUrl) {
    return <PhotoOnSite url={vehicle.url} text={NO_PHOTO_TEXT} />;
  }
  if (broken) {
    return <PhotoOnSite url={vehicle.url} text={PHOTOS_ON_SITE_TEXT} />;
  }
  return (
    <a class="photo" href={vehicle.url} target="_blank" rel="noopener">
      <img src={vehicle.imageUrl} alt={vehicle.title} referrerpolicy="no-referrer" onError={() => setBroken(true)} />
    </a>
  );
};

const OtherSites = ({ vehicle }: { readonly vehicle: VehicleDto }): JSX.Element | null =>
  vehicle.listings.length > 1 ? (
    <div class="others">
      Aussi sur{' '}
      {vehicle.listings.slice(1).map((listing, index) => (
        <Fragment key={listing.id}>
          {index ? ', ' : ''}
          <a href={listing.url} target="_blank" rel="noopener">
            {listing.siteLabel}
          </a>
        </Fragment>
      ))}
    </div>
  ) : null;

const SheetHead = ({ vehicle, now }: { readonly vehicle: VehicleDto; readonly now: number }): JSX.Element => (
  <div class="dhead">
    <h2>{vehicle.name}</h2>
    {vehicle.title !== vehicle.name ? <p class="muted">{vehicle.title}</p> : null}
    <div class="sub">
      {[locationText(vehicle), `${vehicle.siteLabel} · ${whenText(vehicle, now)}`].filter(Boolean).join(' · ')}
      {vehicle.publishedAt ? null : (
        <span class="hint" title={NO_PUBLICATION_DATE_TITLE}>
          {' (date de publication non fournie par le site)'}
        </span>
      )}
    </div>
    <OtherSites vehicle={vehicle} />
  </div>
);

const ReceivedText = ({ vehicle, open }: { readonly vehicle: VehicleDto; readonly open: boolean }): JSX.Element | null =>
  vehicle.description ? (
    <details class="adv desc" open={open}>
      <summary>Texte de l’annonce tel que reçu</summary>
      <p class="desc-text">{vehicle.description}</p>
    </details>
  ) : null;

export const VehicleSheet = ({ vehicle, burst, onActed, onUndone, onMessageSaved }: VehicleSheetProps): JSX.Element => {
  const { refresh } = useAppState();
  const now = refresh.now.value;
  const message = useRef<HTMLTextAreaElement>(null);
  const followUp = followUpText(vehicle, now);
  const inBurst = burst !== undefined;
  const messageField =
    vehicle.matched && vehicle.status === 'nouveau' ? (
      <MessageField vehicle={vehicle} folded={inBurst} textareaRef={message} onSaved={onMessageSaved} />
    ) : null;
  const actions = (
    <VehicleActions
      vehicle={vehicle}
      messageText={() => message.current?.value ?? vehicle.message}
      primaryPlacement={inBurst ? 'first' : 'last'}
      burst={burst}
      onActed={onActed}
      onUndone={onUndone}
    />
  );
  return (
    <article class="card listing detail" id={`v-${vehicle.id}`}>
      <Photo key={vehicle.imageUrl} vehicle={vehicle} />
      <SheetHead vehicle={vehicle} now={now} />
      <VehicleSpecs vehicle={vehicle} />
      <VehicleBadges vehicle={vehicle} />
      {followUp ? <p class="follow">{followUp}</p> : null}
      {inBurst ? actions : messageField}
      {inBurst ? messageField : <NoteField vehicle={vehicle} />}
      <ReceivedText vehicle={vehicle} open={!inBurst} />
      {inBurst ? null : actions}
    </article>
  );
};
