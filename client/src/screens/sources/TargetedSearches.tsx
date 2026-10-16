import type { JSX } from 'preact';
import type { TargetedSearchDto } from '../../../../src/shared/api';
import { Icon } from '../../components/Icon';

export interface TargetedSearchesProps {
  readonly siteLabel: string;
  readonly searches: readonly TargetedSearchDto[];
}

export const TargetedSearches = ({ siteLabel, searches }: TargetedSearchesProps): JSX.Element => (
  <details class="adv targeted">
    <summary>{`Alertes ciblées recommandées (${searches.length})`}</summary>
    <div class="body">
      <p class="small muted">{`${siteLabel} ne met que quelques annonces dans chaque email. Une alerte par petit groupe de marques (3 au plus par recherche sur ce site), avec un prix plancher volontairement sous vos réglages, reste complète la plupart des jours. Pour chacune : ouvrir, vérifier, « Enregistrer ma recherche ». Les groupes sont indicatifs : ce qui compte, c’est que chaque marque de vos réglages soit couverte par une alerte du site. À refaire si vous ajoutez une marque dans Réglages.`}</p>
      <ul class="targeted-list">
        {searches.map((search) => (
          <li key={search.url}>
            <a href={search.url} target="_blank" rel="noopener">
              <Icon name="open" />
              {search.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  </details>
);
