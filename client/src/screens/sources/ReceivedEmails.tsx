import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ProcessedEmailDto, SourceRunSummaryDto } from '../../../../src/shared/api';
import { errorText } from '../../api/errorText';
import { useAppState } from '../../app/AppContext';
import { ReceivedEmail } from './ReceivedEmail';

const REREAD_QUESTION =
  'Relire toute la boîte mail depuis le début ? Les annonces déjà connues sont complétées, pas dupliquées. Utile après une mise à jour de l’application.';

export interface ReceivedEmailsProps {
  readonly emails: readonly ProcessedEmailDto[];
  readonly onReload: () => Promise<void>;
}

export const ReceivedEmails = ({ emails, onReload }: ReceivedEmailsProps): JSX.Element => {
  const { api, toast } = useAppState();
  const [checking, setChecking] = useState(false);
  const [rereading, setRereading] = useState(false);

  const readMailbox = async (
    read: () => Promise<{ readonly mail: SourceRunSummaryDto }>,
    busy: (running: boolean) => void,
  ): Promise<void> => {
    busy(true);
    try {
      const { mail } = await read();
      toast.show(mail.detail, { error: !mail.ok });
      await onReload();
    } catch (error) {
      toast.show(errorText(error), { error: true });
    } finally {
      busy(false);
    }
  };

  const reread = (): void => {
    if (window.confirm(REREAD_QUESTION)) {
      void readMailbox(api.reread, setRereading);
    }
  };

  return (
    <section class="card section">
      <div class="row between">
        <h2>Derniers emails reçus</h2>
        <div class="row">
          <button class="btn quiet small" type="button" disabled={rereading} onClick={reread}>
            {rereading ? 'Relecture…' : 'Tout relire'}
          </button>
          <button class="btn" type="button" disabled={checking} onClick={() => void readMailbox(api.checkNow, setChecking)}>
            {checking ? 'Vérification…' : 'Vérifier maintenant'}
          </button>
        </div>
      </div>
      {emails.length ? (
        <table class="emails">
          <thead>
            <tr>
              <th>Reçu</th>
              <th>Site</th>
              <th>Sujet</th>
              <th class="n">Annonces</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <ReceivedEmail key={email.message_id} email={email} />
            ))}
          </tbody>
        </table>
      ) : (
        <p class="muted small">Aucun email traité pour le moment.</p>
      )}
    </section>
  );
};
