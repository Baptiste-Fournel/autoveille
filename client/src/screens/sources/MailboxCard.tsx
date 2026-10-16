import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { MailboxDto, MailboxSettingsDto } from '../../../../src/shared/api';
import { errorText } from '../../api/errorText';
import { useAppState } from '../../app/AppContext';
import { Field } from '../../components/Field';
import { NumberInput } from '../../components/NumberInput';
import { ago } from '../../format/ago';
import { RunStatus } from './RunStatus';

type MailboxCheck = { readonly running: true } | { readonly running: false; readonly ok: boolean; readonly text: string };

const DANGER = { color: 'var(--danger)' } as const;

const LIST_STYLE = { margin: '0', paddingLeft: '20px' } as const;

const MailboxCheckMessage = ({ check }: { readonly check: MailboxCheck | null }): JSX.Element | null => {
  if (check === null) {
    return null;
  }
  return check.running ? (
    <span class="muted small">Test en cours…</span>
  ) : (
    <div class={`note ${check.ok ? 'ok' : 'warn'}`}>{check.text}</div>
  );
};

export interface MailboxCardProps {
  readonly mailbox: MailboxDto;
  readonly imap: MailboxSettingsDto;
  readonly onSave: (confirmation: string) => Promise<boolean>;
}

export const MailboxCard = ({ mailbox, imap, onSave }: MailboxCardProps): JSX.Element => {
  const { api, settings, refresh } = useAppState();
  const [check, setCheck] = useState<MailboxCheck | null>(null);
  const lastRun = mailbox.lastRun;
  const edit = (change: Partial<MailboxSettingsDto>): void => settings.edit((draft) => ({ ...draft, imap: { ...draft.imap, ...change } }));

  const test = async (): Promise<void> => {
    setCheck({ running: true });
    try {
      const result = await api.testMailbox(imap);
      setCheck({ running: false, ok: result.ok, text: result.detail });
    } catch (error) {
      setCheck({ running: false, ok: false, text: errorText(error) });
    }
  };

  return (
    <section class="card section">
      <div class="row between">
        <h2>Boîte mail des alertes</h2>
        <RunStatus run={lastRun} />
      </div>
      <p class="muted small">
        Les sites envoient leurs nouvelles annonces par email sur une adresse Gmail créée pour ça. L’application la lit toutes les deux
        minutes.
      </p>
      {lastRun ? (
        <p class="small" style={lastRun.ok ? undefined : DANGER}>{`${ago(lastRun.last_run_at, refresh.now.value)} : ${lastRun.detail}`}</p>
      ) : null}
      <div class="grid2">
        <Field label="Adresse Gmail dédiée">
          {(id) => (
            <input
              class="input"
              id={id}
              type="email"
              autocomplete="off"
              placeholder="alertes.concession@gmail.com"
              value={imap.user}
              onInput={(event) => edit({ user: event.currentTarget.value })}
            />
          )}
        </Field>
        <Field
          label="Mot de passe d’application"
          help="Pas le mot de passe Gmail habituel : un mot de passe d’application, voir ci-dessous."
        >
          {(id) => (
            <input
              class="input"
              id={id}
              type="password"
              autocomplete="new-password"
              value={imap.pass}
              onInput={(event) => edit({ pass: event.currentTarget.value })}
            />
          )}
        </Field>
      </div>
      <details class="adv">
        <summary>Obtenir un mot de passe d’application Gmail</summary>
        <div class="body">
          <ol style={LIST_STYLE}>
            <li>Créez l’adresse Gmail dédiée (ou utilisez une adresse existante réservée aux alertes).</li>
            <li>Dans le compte Google : Sécurité, puis activez la validation en deux étapes.</li>
            <li>
              Toujours dans Sécurité, ouvrez « Mots de passe des applications », donnez un nom (AutoVeille) et copiez le code de 16
              caractères ici.
            </li>
          </ol>
        </div>
      </details>
      <details class="adv">
        <summary>Autre fournisseur que Gmail</summary>
        <div class="body">
          <div class="grid2">
            <Field label="Serveur IMAP">
              {(id) => <input class="input" id={id} value={imap.host} onInput={(event) => edit({ host: event.currentTarget.value })} />}
            </Field>
            <Field label="Port">{(id) => <NumberInput id={id} value={imap.port} onValue={(port) => edit({ port })} />}</Field>
          </div>
          <Field label="Dossier">
            {(id) => <input class="input" id={id} value={imap.mailbox} onInput={(event) => edit({ mailbox: event.currentTarget.value })} />}
          </Field>
        </div>
      </details>
      <div class="row">
        <button class="btn" type="button" onClick={() => void test()}>
          Tester la connexion
        </button>
        <button class="btn primary" type="button" onClick={() => void onSave('Boîte mail enregistrée')}>
          Enregistrer
        </button>
      </div>
      <div>
        <MailboxCheckMessage check={check} />
      </div>
    </section>
  );
};
