import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import type { VehicleDto, VehicleUpdateRequest } from '../../../src/shared/api';
import { useAppState } from '../app/AppContext';
import { Icon } from './Icon';
import { openListingAndCopyMessage } from './openListingAndCopyMessage';

export type PrimaryPlacement = 'first' | 'last';

export interface BurstControls {
  readonly onSkip: () => void;
}

export interface VehicleActionsProps {
  readonly vehicle: VehicleDto;
  readonly messageText: () => string;
  readonly primaryPlacement: PrimaryPlacement;
  readonly burst?: BurstControls;
  readonly onActed?: (change: VehicleUpdateRequest) => void;
  readonly onUndone?: (change: VehicleUpdateRequest) => void;
}

type Update = (change: VehicleUpdateRequest, confirmation: string) => Promise<void>;

const CONTACTED_TEXT = 'Passée en « contactée »';

const IGNORED_TEXT = 'Annonce ignorée';

const FILED_TEXT = 'Annonce classée';

const BACK_TO_HANDLE_TEXT = 'Remise à traiter';

interface PrimaryBarProps {
  readonly vehicle: VehicleDto;
  readonly messageText: () => string;
  readonly sticky: boolean;
  readonly burst: BurstControls | undefined;
  readonly update: Update;
}

const PrimaryBar = ({ vehicle, messageText, sticky, burst, update }: PrimaryBarProps): JSX.Element => {
  const { pendingConfirmation, toast } = useAppState();
  const confirmBox = useRef<HTMLDivElement>(null);
  const asking = pendingConfirmation.value === vehicle.id;

  const openAndAsk = async (): Promise<void> => {
    pendingConfirmation.value = vehicle.id;
    await openListingAndCopyMessage(vehicle.url, messageText(), toast);
    confirmBox.current?.scrollIntoView?.({ block: 'nearest' });
  };

  const notNow = (): void => {
    if (pendingConfirmation.value === vehicle.id) {
      pendingConfirmation.value = null;
    }
    burst?.onSkip();
  };

  return (
    <div class={sticky ? 'primary-bar sticky' : 'primary-bar'}>
      <button class="btn primary big" type="button" onClick={() => void openAndAsk()}>
        <Icon name="open" />
        Ouvrir l’annonce et copier le message
      </button>
      <div ref={confirmBox} class={asking ? 'confirm' : 'confirm hidden'}>
        <b>Message envoyé au vendeur ?</b>
        <button
          class="btn primary small"
          type="button"
          onClick={() => void update({ status: 'contacte' }, burst ? 'Envoyée, à la suivante' : CONTACTED_TEXT)}
        >
          {burst ? 'Oui, envoyé, suivante' : 'Oui, envoyé'}
        </button>
        {burst ? (
          <button class="btn small" type="button" onClick={() => void update({ status: 'ignore' }, IGNORED_TEXT)}>
            Non, ignorer
          </button>
        ) : null}
        <button class="btn small quiet" type="button" onClick={notNow}>
          {burst ? 'Passer' : 'Pas maintenant'}
        </button>
      </div>
    </div>
  );
};

const ListingLink = ({ url, text }: { readonly url: string; readonly text: string }): JSX.Element => (
  <a class="btn" href={url} target="_blank" rel="noopener">
    <Icon name="open" />
    {text}
  </a>
);

interface SecondaryActionsProps {
  readonly vehicle: VehicleDto;
  readonly burst: BurstControls | undefined;
  readonly update: Update;
}

const SecondaryActions = ({ vehicle, burst, update }: SecondaryActionsProps): JSX.Element => {
  if (!vehicle.matched) {
    return (
      <div class="actions">
        <ul class="reasons">
          {vehicle.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div class="secondary">
          <ListingLink url={vehicle.url} text="Voir l’annonce" />
          <button class="btn" type="button" onClick={() => void update({ keep: true, status: 'nouveau' }, 'Annonce gardée')}>
            Garder quand même
          </button>
        </div>
      </div>
    );
  }
  if (vehicle.status === 'nouveau') {
    return (
      <div class="actions">
        <div class="secondary">
          <button class="btn quiet" type="button" onClick={() => void update({ status: 'contacte' }, CONTACTED_TEXT)}>
            Déjà contacté
          </button>
          <button class="btn quiet" type="button" onClick={() => void update({ status: 'ignore' }, IGNORED_TEXT)}>
            Ignorer
          </button>
          <button
            class="btn quiet danger"
            type="button"
            onClick={() => void update({ doNotContact: true }, 'Vendeur ajouté à la liste « ne plus contacter »')}
          >
            Ne plus contacter
          </button>
          {burst ? (
            <button class="btn quiet" type="button" onClick={burst.onSkip}>
              Passer
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  if (vehicle.status === 'contacte') {
    return (
      <div class="actions">
        <div class="secondary">
          <ListingLink url={vehicle.url} text="Revoir l’annonce" />
          <button class="btn primary" type="button" onClick={() => void update({ status: 'repondu' }, 'Noté : le vendeur a répondu')}>
            Le vendeur a répondu
          </button>
          <button class="btn quiet" type="button" onClick={() => void update({ status: 'ignore' }, FILED_TEXT)}>
            Sans suite
          </button>
          <button
            class="btn quiet"
            type="button"
            title="Si vous l’avez marquée contactée par erreur"
            onClick={() => void update({ status: 'nouveau' }, BACK_TO_HANDLE_TEXT)}
          >
            Pas encore contactée
          </button>
        </div>
      </div>
    );
  }
  return (
    <div class="actions">
      <div class="secondary">
        <ListingLink url={vehicle.url} text="Voir l’annonce" />
        {vehicle.status === 'repondu' ? (
          <button class="btn quiet" type="button" onClick={() => void update({ status: 'ignore' }, FILED_TEXT)}>
            Classer
          </button>
        ) : null}
        {vehicle.doNotContact ? null : (
          <button class="btn quiet" type="button" onClick={() => void update({ status: 'nouveau' }, BACK_TO_HANDLE_TEXT)}>
            Remettre à traiter
          </button>
        )}
      </div>
    </div>
  );
};

export const VehicleActions = ({ vehicle, messageText, primaryPlacement, burst, onActed, onUndone }: VehicleActionsProps): JSX.Element => {
  const { changes } = useAppState();

  const update: Update = async (change, confirmation) => {
    const saved = await changes.act(vehicle, change, confirmation, { onUndone: () => onUndone?.(change) });
    if (saved !== null) {
      onActed?.(change);
    }
  };

  const secondary = <SecondaryActions vehicle={vehicle} burst={burst} update={update} />;
  const primary =
    vehicle.matched && vehicle.status === 'nouveau' ? (
      <PrimaryBar vehicle={vehicle} messageText={messageText} sticky={primaryPlacement === 'last'} burst={burst} update={update} />
    ) : null;

  if (primaryPlacement === 'last') {
    return (
      <>
        {secondary}
        {primary}
      </>
    );
  }
  return (
    <>
      {primary === null ? null : <div class="actions">{primary}</div>}
      {secondary}
    </>
  );
};
