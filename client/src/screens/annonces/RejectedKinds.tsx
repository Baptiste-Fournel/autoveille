import type { JSX } from 'preact';
import type { RejectedKind, RejectedKindCountsDto } from '../../../../src/shared/api';

const KIND_OPTIONS: readonly (readonly [RejectedKind, string])[] = [
  ['suivies', 'Marques suivies'],
  ['loin', 'Trop loin'],
  ['km', 'Trop de km'],
  ['special', 'Ni supercar ni collection'],
  ['pro', 'Vendeur pro'],
  ['marque', 'Autres marques'],
  ['tous', 'Toutes'],
];

const LOOK_NOW_AND_THEN_TEXT =
  'Les 14 derniers jours. Un coup d’œil de temps en temps : « Garder quand même » remet une annonce à traiter.';

export interface RejectedKindsProps {
  readonly counts: RejectedKindCountsDto | null;
  readonly selected: RejectedKind;
  readonly onSelect: (kind: RejectedKind) => void;
}

export const RejectedKinds = ({ counts, selected, onSelect }: RejectedKindsProps): JSX.Element => (
  <div class="kinds">
    <p class="muted small">{LOOK_NOW_AND_THEN_TEXT}</p>
    <div class="filterbar">
      {KIND_OPTIONS.map(([kind, label]) => {
        const count = counts?.[kind] ?? 0;
        return (
          <button key={kind} class="chip" type="button" aria-pressed={selected === kind} onClick={() => onSelect(kind)}>
            {label}
            {count ? <span class="badge count">{count}</span> : null}
          </button>
        );
      })}
    </div>
  </div>
);
