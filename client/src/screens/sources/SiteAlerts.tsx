import type { JSX } from 'preact';
import type { SiteDto } from '../../../../src/shared/api';
import { MAIN_SITES } from '../../sites/mainSites';
import { SiteAlert } from './SiteAlert';

export interface SiteAlertsProps {
  readonly sites: readonly SiteDto[];
  readonly city: string;
  readonly onMark: (site: SiteDto, done: boolean) => void;
}

export const SiteAlerts = ({ sites, city, onMark }: SiteAlertsProps): JSX.Element => {
  const row = (site: SiteDto): JSX.Element => <SiteAlert key={site.key} site={site} city={city} onMark={onMark} />;
  return (
    <section class="card section">
      <h2>Les alertes sur les sites</h2>
      <p class="muted small">
        Chaque site envoie ses nouvelles annonces à la boîte mail ci-dessus. L’alerte se crée une fois, sur le site, et volontairement large
        (toutes marques, particuliers, un rayon et un kilométrage plus grands que vos réglages) : c’est l’application qui trie, et ce
        qu’elle écarte reste consultable dans « Écartées par les filtres ». Quand le site confirme l’alerte par email, elle apparaît
        ci-dessous avec ses critères.
      </p>
      {sites.filter((site) => MAIN_SITES.includes(site.key)).map(row)}
      <details class="adv">
        <summary>Autres sites, facultatifs</summary>
        <div class="body">{sites.filter((site) => !MAIN_SITES.includes(site.key)).map(row)}</div>
      </details>
    </section>
  );
};
