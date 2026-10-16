import type { JSX } from 'preact';
import { Icon } from '../../components/Icon';
import { ago } from '../../format/ago';
import type { RecentDigest } from './truncatedDigest';

export interface TruncatedDigestNoteProps {
  readonly digest: RecentDigest;
  readonly siteLabel: string;
  readonly now: number;
}

export const TruncatedDigestNote = ({ digest, siteLabel, now }: TruncatedDigestNoteProps): JSX.Element => {
  const missing = digest.announced - digest.received;
  return (
    <div class="note warn digest">
      <div>
        <b>{`${digest.announced} nouvelles annonces annoncées ${ago(digest.at, now)}, ${digest.received} ${digest.received > 1 ? 'arrivées' : 'arrivée'} dans l’application.`}</b>
        {` Ce site n’envoie par email qu’un aperçu : les ${missing} autres ne sont visibles que sur le site, et l’application ne peut pas aller les lire à votre place.`}
      </div>
      {digest.url ? (
        <a class="btn small" href={digest.url} target="_blank" rel="noopener">
          <Icon name="open" />
          {`Voir les ${missing} autres sur ${siteLabel}`}
        </a>
      ) : null}
    </div>
  );
};
