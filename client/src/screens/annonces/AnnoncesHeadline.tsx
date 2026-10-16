import type { JSX } from 'preact';
import type { ListedStatus, OverviewResponse } from '../../../../src/shared/api';
import { Icon } from '../../components/Icon';
import { ago } from '../../format/ago';
import { plural } from '../../format/plural';
import { listedStatusLabel } from './listedStatuses';

const BURST_FROM_COUNT = 2;

const titleOf = (overview: OverviewResponse, status: ListedStatus): string => {
  if (status !== 'nouveau') {
    return listedStatusLabel(status);
  }
  const toHandle = overview.counts.nouveau;
  return toHandle ? plural(toHandle, 'annonce à traiter', 'annonces à traiter') : 'Rien à traiter pour le moment';
};

const mailboxText = (overview: OverviewResponse, now: number): string => {
  const lastRun = overview.sources.find((source) => source.source === 'email');
  if (lastRun?.last_run_at) {
    return ` · boîte mail vérifiée ${ago(lastRun.last_run_at, now)}`;
  }
  return overview.imapConfigured ? '' : ' · boîte mail pas encore reliée';
};

const WeekLine = ({ week }: { readonly week: OverviewResponse['week'] }): JSX.Element | null =>
  week.received || week.contacted || week.replied ? (
    <p class="muted small week">
      {`7 derniers jours : ${plural(week.received, 'annonce retenue', 'annonces retenues')}, ${plural(week.contacted, 'contactée', 'contactées')}, ${plural(week.replied, 'réponse', 'réponses')}.`}
    </p>
  ) : null;

export interface AnnoncesHeadlineProps {
  readonly overview: OverviewResponse;
  readonly status: ListedStatus;
  readonly now: number;
}

export const AnnoncesHeadline = ({ overview, status, now }: AnnoncesHeadlineProps): JSX.Element => {
  const toHandle = overview.counts.nouveau;
  return (
    <div class="headline">
      <h1>{titleOf(overview, status)}</h1>
      <p class="muted">
        {`${overview.zone.city}, ${overview.zone.radiusKm} km`}
        {mailboxText(overview, now)}
      </p>
      <WeekLine week={overview.week} />
      {status === 'nouveau' && toHandle >= BURST_FROM_COUNT ? (
        <a class="btn primary rafale-cta" href="#/rafale">
          <Icon name="bolt" />
          {`Traiter en rafale (${toHandle})`}
        </a>
      ) : null}
    </div>
  );
};
