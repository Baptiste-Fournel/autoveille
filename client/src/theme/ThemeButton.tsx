import type { JSX } from 'preact';
import { useAppState } from '../app/AppContext';
import { Icon } from '../components/Icon';

const TO_LIGHT_TEXT = 'Passer en mode clair';

const TO_DARK_TEXT = 'Passer en mode sombre';

export const ThemeButton = (): JSX.Element => {
  const { theme } = useAppState();
  const dark = theme.isDark.value;
  const label = dark ? TO_LIGHT_TEXT : TO_DARK_TEXT;
  return (
    <button class="theme-btn" type="button" onClick={theme.toggle} title={label} aria-label={label} aria-pressed={dark}>
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
};
