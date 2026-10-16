import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readDotEnvFile } from '../../../src/infrastructure/config/dotEnv.js';
import { InvalidConfiguration } from '../../../src/infrastructure/config/invalidConfiguration.js';
import { loadConfig } from '../../../src/infrastructure/config/loadConfig.js';

const ENV_EXAMPLE = fileURLToPath(new URL('../../../.env.example', import.meta.url));

const APP_DIRECTORY = '/opt/autoveille';

const INSTALLED_DOT_ENV = [
  'PORT=3000',
  'HOST=127.0.0.1',
  'DATA_DIR=/opt/autoveille/data',
  'SETUP_CODE=7F3A9C1E',
  'CONTACT_EMAIL=contact@garage-du-lac.fr',
  '',
].join('\n');

const configFailure = (load: () => unknown): unknown => {
  try {
    load();
    return undefined;
  } catch (error) {
    return error;
  }
};

describe('configuration lue dans le fichier .env et l’environnement', () => {
  it('sans fichier .env ni variable, les valeurs par défaut conviennent pour un essai en local', () => {
    // Given
    const sources = { environment: {}, dotEnv: '', workingDirectory: '/Users/concession/autoveille' };

    // When
    const config = loadConfig(sources);

    // Then
    expect(config).toEqual({
      port: 3000,
      host: '127.0.0.1',
      baseUrl: '',
      dataDir: '/Users/concession/autoveille/data',
      setupCode: '',
      appPassword: '',
      contactEmail: '',
      imapPollMinutes: 2,
      httpPollMinutes: 30,
      imapIdle: true,
      demo: false,
    });
  });

  it('le .env écrit par deploy/install.sh sur le serveur : dossier des données, code de première connexion et adresse de contact', () => {
    // Given
    const sources = { environment: {}, dotEnv: INSTALLED_DOT_ENV, workingDirectory: APP_DIRECTORY };

    // When
    const config = loadConfig(sources);

    // Then
    expect(config).toMatchObject({
      port: 3000,
      host: '127.0.0.1',
      dataDir: '/opt/autoveille/data',
      setupCode: '7F3A9C1E',
      contactEmail: 'contact@garage-du-lac.fr',
    });
  });

  it('le .env.example copié tel quel : commentaires ignorés, champs vides gardés vides, démonstration désactivée', () => {
    // Given
    const sources = { environment: {}, dotEnv: readDotEnvFile(ENV_EXAMPLE), workingDirectory: '/Users/concession/autoveille' };

    // When
    const config = loadConfig(sources);

    // Then
    expect(config).toEqual({
      port: 3000,
      host: '127.0.0.1',
      baseUrl: '',
      dataDir: './data',
      setupCode: '',
      appPassword: '',
      contactEmail: '',
      imapPollMinutes: 2,
      httpPollMinutes: 30,
      imapIdle: true,
      demo: false,
    });
  });

  it('une variable déjà définie dans l’environnement l’emporte sur le fichier .env', () => {
    // Given
    const sources = { environment: { PORT: '8080', SETUP_CODE: '' }, dotEnv: INSTALLED_DOT_ENV, workingDirectory: APP_DIRECTORY };

    // When
    const config = loadConfig(sources);

    // Then
    expect(config.port).toBe(8080);
    expect(config.setupCode).toBe('');
    expect(config.contactEmail).toBe('contact@garage-du-lac.fr');
  });

  it('des valeurs entre guillemets dans le .env : les guillemets sont retirés, les espaces intérieurs gardés', () => {
    // Given
    const dotEnv = ['APP_PASSWORD="Porsche 911 de 1973"', "SETUP_CODE='7F3A9C1E'", 'BASE_URL=  https://veille.garage-du-lac.fr  '].join(
      '\n',
    );

    // When
    const config = loadConfig({ environment: {}, dotEnv, workingDirectory: APP_DIRECTORY });

    // Then
    expect(config.appPassword).toBe('Porsche 911 de 1973');
    expect(config.setupCode).toBe('7F3A9C1E');
    expect(config.baseUrl).toBe('https://veille.garage-du-lac.fr');
  });

  it('DEMO=1 dans l’environnement : les annonces d’exemple seront chargées', () => {
    // Given
    const sources = { environment: { DEMO: '1' }, dotEnv: '', workingDirectory: APP_DIRECTORY };

    // When
    const config = loadConfig(sources);

    // Then
    expect(config.demo).toBe(true);
  });

  it('comportement hérité : une variable écrite deux fois dans le .env garde sa première valeur', () => {
    // Given
    const dotEnv = `${INSTALLED_DOT_ENV}IMAP_POLL_MINUTES=2\nIMAP_POLL_MINUTES=5\n`;

    // When
    const config = loadConfig({ environment: {}, dotEnv, workingDirectory: APP_DIRECTORY });

    // Then
    expect(config.imapPollMinutes).toBe(2);
  });

  it('une faute de frappe dans IMAP_POLL_MINUTES (« deux ») arrête le démarrage avec un message clair', () => {
    // Given
    const dotEnv = `${INSTALLED_DOT_ENV}IMAP_POLL_MINUTES=deux\n`;

    // When
    const failure = configFailure(() => loadConfig({ environment: {}, dotEnv, workingDirectory: APP_DIRECTORY }));

    // Then
    expect(failure).toBeInstanceOf(InvalidConfiguration);
    expect(failure instanceof Error ? failure.message : undefined).toBe('IMAP_POLL_MINUTES doit être un nombre (valeur lue : « deux »).');
  });

  it('IMAP_IDLE=0 dans le .env : la boîte n’est plus surveillée en IDLE, seulement relue à la cadence d’IMAP_POLL_MINUTES', () => {
    // Given
    const dotEnv = `${INSTALLED_DOT_ENV}IMAP_IDLE=0\n`;

    // When
    const config = loadConfig({ environment: {}, dotEnv, workingDirectory: APP_DIRECTORY });

    // Then
    expect(config.imapIdle).toBe(false);
  });

  it('IMAP_IDLE=oui au lieu de 1 arrête le démarrage avec un message clair, au lieu de deviner', () => {
    // Given
    const dotEnv = `${INSTALLED_DOT_ENV}IMAP_IDLE=oui\n`;

    // When
    const failure = configFailure(() => loadConfig({ environment: {}, dotEnv, workingDirectory: APP_DIRECTORY }));

    // Then
    expect(failure).toBeInstanceOf(InvalidConfiguration);
    expect(failure instanceof Error ? failure.message : undefined).toBe('IMAP_IDLE doit valoir 0 ou 1 (valeur lue : « oui »).');
  });

  it('PORT laissé vide dans le .env arrête le démarrage avec un message clair, au lieu d’écouter sur un port au hasard', () => {
    // Given
    const dotEnv = INSTALLED_DOT_ENV.replace('PORT=3000', 'PORT=');

    // When
    const failure = configFailure(() => loadConfig({ environment: {}, dotEnv, workingDirectory: APP_DIRECTORY }));

    // Then
    expect(failure instanceof Error ? failure.message : undefined).toBe('PORT doit être un nombre (valeur lue : «  »).');
  });
});
