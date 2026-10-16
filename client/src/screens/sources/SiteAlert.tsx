import type { JSX } from 'preact';
import type { SiteDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { ago } from '../../format/ago';
import { formatInteger } from '../../format/integer';
import { TargetedSearches } from './TargetedSearches';
import { TruncatedDigestNote } from './TruncatedDigestNote';
import { recentDigest } from './truncatedDigest';

export interface SiteAlertProps {
  readonly site: SiteDto;
  readonly city: string;
  readonly onMark: (site: SiteDto, done: boolean) => void;
}

const AlertStatus = ({ site }: { readonly site: SiteDto }): JSX.Element => {
  if (site.alert) {
    return <span class="badge ok">Alerte active</span>;
  }
  return site.done ? <span class="badge ok">Alerte créée</span> : <span class="badge warn">À créer</span>;
};

const prefilledSearchText = (site: SiteDto, city: string): string =>
  site.prefilled
    ? `La recherche pré-remplie prend ${site.alertRadiusKm} km autour de ${city || 'la ville'}, ${formatInteger(site.alertMaxKm)} km au compteur maximum, vendeurs particuliers, toutes marques : exprès plus large que vos réglages. `
    : '';

export const SiteAlert = ({ site, city, onMark }: SiteAlertProps): JSX.Element => {
  const { refresh } = useAppState();
  const now = refresh.now.value;
  const alert = site.alert;
  const done = Boolean(site.done || alert);
  const manage = alert?.manageUrl || site.manageUrl || site.searchUrl;
  const digest = recentDigest(site.digest, now);
  const notes: readonly JSX.Element[] = [
    ...site.issues.map((issue) => (
      <div key={issue} class="note warn">
        {issue}
      </div>
    )),
    ...(site.issues.length === 0 && site.advice
      ? [
          <div key="advice" class="note">
            {site.advice}
          </div>,
        ]
      : []),
    ...(digest === null ? [] : [<TruncatedDigestNote key="digest" digest={digest} siteLabel={site.label} now={now} />]),
  ];
  return (
    <div class="site">
      <div class="shead">
        <h3>{site.label}</h3>
        <AlertStatus site={site} />
      </div>
      {alert ? (
        <p class="small">
          <b>Ce que le site enverra : </b>
          {alert.criteria}
          {alert.confirmedAt ? <span class="muted">{` (confirmé par le site ${ago(alert.confirmedAt, now)})`}</span> : null}
        </p>
      ) : null}
      {notes}
      {done && notes.length === 0 ? null : (
        <p class="small muted">
          {prefilledSearchText(site, city)}
          {site.help}
        </p>
      )}
      {done ? (
        <div class="row">
          <a class="btn small" href={manage} target="_blank" rel="noopener">
            <Icon name="open" />
            Modifier l’alerte sur le site
          </a>
          {alert ? null : (
            <button class="btn quiet small" type="button" onClick={() => onMark(site, false)}>
              Pas encore créée
            </button>
          )}
        </div>
      ) : (
        <div class="row">
          <a class="btn primary small" href={site.searchUrl} target="_blank" rel="noopener">
            <Icon name="open" />
            {site.prefilled ? 'Créer l’alerte (recherche pré-remplie)' : 'Créer l’alerte sur le site'}
          </a>
          <button class="btn quiet small" type="button" onClick={() => onMark(site, true)}>
            C’est fait
          </button>
        </div>
      )}
      {site.targeted.length ? <TargetedSearches siteLabel={site.label} searches={site.targeted} /> : null}
    </div>
  );
};
