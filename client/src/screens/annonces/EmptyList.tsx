import type { JSX } from 'preact';
import type { ListedStatus } from '../../../../src/shared/api';
import { Icon } from '../../components/Icon';

const titleOf = (status: ListedStatus): string => {
  if (status === 'nouveau') {
    return 'Aucune annonce en attente';
  }
  return status === 'ecartees' ? 'Rien d’écarté dans cette catégorie' : 'Rien ici';
};

export interface EmptyListProps {
  readonly status: ListedStatus;
  readonly imapConfigured: boolean;
}

export const EmptyList = ({ status, imapConfigured }: EmptyListProps): JSX.Element => (
  <div class="empty">
    <Icon name="car" />
    <b>{titleOf(status)}</b>
    <p>{status === 'nouveau' ? 'Les nouvelles annonces arrivent ici dès qu’un site envoie une alerte.' : ''}</p>
    {imapConfigured ? null : (
      <a class="btn" href="#/sources">
        Relier la boîte mail des alertes
      </a>
    )}
  </div>
);
