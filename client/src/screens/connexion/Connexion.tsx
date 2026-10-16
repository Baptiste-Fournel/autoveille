import { useSignal } from '@preact/signals';
import type { JSX, TargetedSubmitEvent } from 'preact';
import { ApiError } from '../../api/ApiError';
import { errorText } from '../../api/errorText';
import { useAppState } from '../../app/AppContext';
import { Icon } from '../../components/Icon';

const SETUP_WITH_CODE_TEXT =
  'Première connexion. Saisissez le code fourni à l’installation, puis choisissez le mot de passe qui servira ensuite à ouvrir l’application.';

const SETUP_TEXT = 'Première connexion. Choisissez le mot de passe qui servira ensuite à ouvrir l’application.';

const WELCOME_TEXT = 'Les nouvelles annonces qui vous intéressent, avec le message prêt à envoyer.';

const NEW_PASSWORD_MIN_LENGTH = 8;

const UNAUTHORIZED = 401;

const isRefusedPassword = (error: unknown): boolean => error instanceof ApiError && error.status === UNAUTHORIZED;

const textOf = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

export const Connexion = (): JSX.Element => {
  const { session, toast } = useAppState();
  const me = session.me.value;
  const setup = me?.needsSetup === true;
  const needCode = setup && me?.setupCodeRequired !== false;
  const refusals = useSignal(0);

  const submit = async (event: TargetedSubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      if (setup) {
        await session.setUp(textOf(form, 'code'), textOf(form, 'password'));
      } else {
        await session.signIn(textOf(form, 'password'));
      }
    } catch (error) {
      if (isRefusedPassword(error)) {
        refusals.value += 1;
      }
      toast.show(errorText(error), { error: true });
    }
  };

  return (
    <div class="login">
      <form key={refusals.value} class="card" onSubmit={submit}>
        <div class="brand">
          <Icon name="logo" />
          AutoVeille
        </div>
        <p class="muted">{setup ? (needCode ? SETUP_WITH_CODE_TEXT : SETUP_TEXT) : WELCOME_TEXT}</p>
        {needCode ? (
          <div class="field">
            <label for="code">Code de première connexion</label>
            <input class="input" id="code" name="code" autocomplete="off" required />
          </div>
        ) : null}
        <div class="field">
          <label for="password">{setup ? 'Nouveau mot de passe (8 caractères minimum)' : 'Mot de passe'}</label>
          <input
            class="input"
            id="password"
            name="password"
            type="password"
            autocomplete={setup ? 'new-password' : 'current-password'}
            required
            minlength={setup ? NEW_PASSWORD_MIN_LENGTH : 1}
          />
        </div>
        <button class="btn primary big" type="submit">
          {setup ? 'Commencer' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
};
