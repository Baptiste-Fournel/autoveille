import { resolve } from 'node:path';
import { parseDotEnv } from './dotEnv.js';
import { InvalidConfiguration } from './invalidConfiguration.js';

export interface Config {
  readonly port: number;
  readonly host: string;
  readonly baseUrl: string;
  readonly dataDir: string;
  readonly setupCode: string;
  readonly appPassword: string;
  readonly contactEmail: string;
  readonly imapPollMinutes: number;
  readonly httpPollMinutes: number;
  readonly imapIdle: boolean;
  readonly demo: boolean;
}

export interface ConfigSources {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly dotEnv: string;
  readonly workingDirectory: string;
}

type Variables = (name: string) => string | undefined;

const variablesOf = ({ environment, dotEnv }: ConfigSources): Variables => {
  const fromFile = parseDotEnv(dotEnv);
  return (name) => environment[name] ?? fromFile.find(([entryName]) => entryName === name)?.[1];
};

const numberOf = (variables: Variables, name: string, fallback: number): number => {
  const value = variables(name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = value.trim() === '' ? Number.NaN : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new InvalidConfiguration(name, value, 'number');
  }
  return parsed;
};

const switchOf = (variables: Variables, name: string, fallback: boolean): boolean => {
  const value = variables(name);
  if (value === undefined) {
    return fallback;
  }
  if (value !== '0' && value !== '1') {
    throw new InvalidConfiguration(name, value, 'zeroOrOne');
  }
  return value === '1';
};

export const loadConfig = (sources: ConfigSources): Config => {
  const variables = variablesOf(sources);
  return {
    port: numberOf(variables, 'PORT', 3000),
    host: variables('HOST') ?? '127.0.0.1',
    baseUrl: variables('BASE_URL') ?? '',
    dataDir: variables('DATA_DIR') ?? resolve(sources.workingDirectory, 'data'),
    setupCode: variables('SETUP_CODE') ?? '',
    appPassword: variables('APP_PASSWORD') ?? '',
    contactEmail: variables('CONTACT_EMAIL') ?? '',
    imapPollMinutes: numberOf(variables, 'IMAP_POLL_MINUTES', 2),
    httpPollMinutes: numberOf(variables, 'HTTP_POLL_MINUTES', 30),
    imapIdle: switchOf(variables, 'IMAP_IDLE', true),
    demo: variables('DEMO') === '1',
  };
};
