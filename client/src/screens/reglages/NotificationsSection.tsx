import type { JSX } from 'preact';
import type { CheckResultDto, NotificationSettingsDto } from '../../../../src/shared/api';
import { errorText } from '../../api/errorText';
import { useAppState } from '../../app/AppContext';
import { Field } from '../../components/Field';
import type { Toast } from '../../state/toast';
import { Switch } from './Switch';

const TELEGRAM_HELP =
  'Pour recevoir aussi un message Telegram : créez un bot avec @BotFather, collez son jeton ici, envoyez-lui un message puis indiquez votre identifiant (obtenu avec @userinfobot).';

const announceCheck = async (toast: Pick<Toast, 'show'>, check: () => Promise<CheckResultDto>): Promise<void> => {
  try {
    const result = await check();
    toast.show(result.detail, { error: !result.ok });
  } catch (error) {
    toast.show(errorText(error), { error: true });
  }
};

export const NotificationsSection = ({ notifications }: { readonly notifications: NotificationSettingsDto }): JSX.Element => {
  const { api, push, settings, toast } = useAppState();
  const write = (change: Partial<NotificationSettingsDto>): void =>
    settings.edit((draft) => ({ ...draft, notifications: { ...draft.notifications, ...change } }));
  return (
    <section class="card section">
      <h2>Notifications</h2>
      <Switch
        title="Notification à chaque nouvelle annonce"
        help="Sur le téléphone ou l’ordinateur où l’application est ouverte ou installée."
        on={notifications.push}
        onToggle={() =>
          settings.edit((draft) => ({ ...draft, notifications: { ...draft.notifications, push: !draft.notifications.push } }))
        }
      />
      <div class="row">
        <button class="btn" type="button" onClick={() => void push.enable()}>
          Activer sur cet appareil
        </button>
        <button class="btn quiet" type="button" onClick={() => void announceCheck(toast, api.testPush)}>
          Envoyer un test
        </button>
        <span class="muted small" id="push-status">
          {push.statusText()}
        </span>
      </div>
      <details class="adv">
        <summary>Telegram (facultatif)</summary>
        <div class="body">
          <p class="muted small">{TELEGRAM_HELP}</p>
          <div class="grid2">
            <Field label="Jeton du bot">
              {(id) => (
                <input
                  class="input"
                  id={id}
                  value={notifications.telegramToken}
                  autocomplete="off"
                  onInput={(event) => write({ telegramToken: event.currentTarget.value })}
                />
              )}
            </Field>
            <Field label="Identifiant de conversation">
              {(id) => (
                <input
                  class="input"
                  id={id}
                  value={notifications.telegramChatId}
                  inputmode="numeric"
                  onInput={(event) => write({ telegramChatId: event.currentTarget.value })}
                />
              )}
            </Field>
          </div>
          <div>
            <button
              class="btn small"
              type="button"
              onClick={() =>
                void announceCheck(toast, () =>
                  api.testTelegram({ token: notifications.telegramToken, chatId: notifications.telegramChatId }),
                )
              }
            >
              Envoyer un test Telegram
            </button>
          </div>
        </div>
      </details>
    </section>
  );
};
