import { render } from 'preact';
import { registerServiceWorker } from '../push/serviceWorkerRegistration';
import { type AppEnvironment, type AppState, createAppState } from '../state/appState';
import { App } from './App';
import { startRefreshTriggers } from './refreshTriggers';

export interface RunningApplication {
  readonly state: AppState;
  readonly stop: () => void;
}

export const startApplication = async (environment: AppEnvironment, root: HTMLElement): Promise<RunningApplication> => {
  const state = createAppState(environment);
  await registerServiceWorker(environment.window.navigator, state.refresh.request);
  await state.push.check();
  render(<App state={state} />, root);
  await state.session.load();
  const stopTriggers = startRefreshTriggers(state, environment.window.document);
  return {
    state,
    stop: () => {
      stopTriggers();
      state.stop();
      render(null, root);
    },
  };
};
