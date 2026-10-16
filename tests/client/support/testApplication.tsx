import { render } from '@testing-library/preact';
import { onTestFinished, vi } from 'vitest';
import { App } from '../../../client/src/app/App';
import { type AppState, createAppState } from '../../../client/src/state/appState';
import type { MeResponse } from '../../../src/shared/api';
import { type FakeServer, fakeServer, json } from './fakeServer';

export const SIGNED_IN: MeResponse = { authenticated: true, needsSetup: false, setupCodeRequired: false };

export const serverForSignedInDealer = (): FakeServer => {
  const server = fakeServer();
  server.on('GET', '/api/me', () => json(200, SIGNED_IN));
  return server;
};

export const applicationState = (server: FakeServer): AppState => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const state = createAppState({ fetch: server.fetch, window });
  onTestFinished(() => state.stop());
  return state;
};

export const renderedApplication = async (server: FakeServer): Promise<AppState> => {
  const state = applicationState(server);
  render(<App state={state} />);
  await state.session.load();
  return state;
};
