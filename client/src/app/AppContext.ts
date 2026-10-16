import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { AppState } from '../state/appState';

export const AppContext = createContext<AppState | null>(null);

export const useAppState = (): AppState => {
  const state = useContext(AppContext);
  if (state === null) {
    throw new Error('AppContext absent : rendre le composant sous <App>.');
  }
  return state;
};
