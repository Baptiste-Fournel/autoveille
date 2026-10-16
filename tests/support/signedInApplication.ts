import { onTestFinished } from 'vitest';
import { OWNER_PASSWORD, SESSION_COOKIE } from './authentication.js';
import { type ComposedApplication, type ComposedApplicationOptions, composedApplication } from './composedApplication.js';

export interface SignedInApplication {
  readonly application: ComposedApplication;
  readonly session: { readonly cookie: string };
  readonly signedSession: string;
}

export const runningApplication = async (options: ComposedApplicationOptions = {}): Promise<ComposedApplication> => {
  const application = await composedApplication(options);
  onTestFinished(() => application.stop());
  return application;
};

export const signedInApplication = async (options: ComposedApplicationOptions = {}): Promise<SignedInApplication> => {
  const application = await runningApplication(options);
  const response = await application.server.inject({ method: 'POST', url: '/api/setup', payload: { password: OWNER_PASSWORD } });
  const cookie = response.cookies.find((candidate) => candidate.name === SESSION_COOKIE);
  if (cookie === undefined) {
    throw new Error(`Première connexion refusée (${response.statusCode}) : ${response.body}`);
  }
  return { application, session: { cookie: `${SESSION_COOKIE}=${cookie.value}` }, signedSession: cookie.value };
};
