import type { JSX } from 'preact';
import { useAppState } from '../../app/AppContext';
import { Field } from '../../components/Field';
import type { ThemeChoice } from '../../theme/themeChoice';

const THEME_CHOICES: readonly { readonly choice: ThemeChoice; readonly label: string }[] = [
  { choice: 'auto', label: 'Comme l’appareil' },
  { choice: 'light', label: 'Clair' },
  { choice: 'dark', label: 'Sombre' },
];

const THEME_HELP =
  'L’icône en haut de l’écran bascule entre clair et sombre. « Comme l’appareil » suit le réglage du téléphone. Choix propre à cet appareil.';

export const DisplaySection = (): JSX.Element => {
  const { theme } = useAppState();
  const current = theme.choice.value;
  return (
    <section class="card section">
      <h2>Affichage</h2>
      <Field label="Thème" help={THEME_HELP}>
        {(id) => (
          <div class="segmented" id={id} role="toolbar" aria-label="Thème">
            {THEME_CHOICES.map(({ choice, label }) => (
              <button key={choice} type="button" aria-pressed={current === choice} onClick={() => theme.apply(choice)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </Field>
    </section>
  );
};
