export const firstSignInText = (setupCodeConfigured: boolean): string =>
  setupCodeConfigured
    ? 'Première connexion : ouvrez l’application et saisissez le code SETUP_CODE pour choisir le mot de passe.'
    : 'Première connexion : ouvrez l’application depuis cette machine pour choisir le mot de passe.';

export const DEMO_LOADED_TEXT = 'Données de démonstration chargées (DEMO=1).';

export const scheduledPassFailedLog = (error: string): string => `lecture planifiée en échec : ${error}`;

export const sessionCleanupFailedLog = (error: string): string => `nettoyage des sessions en échec : ${error}`;

export const newerDatabaseText = (databaseVersion: number, latestKnownVersion: number): string =>
  `Base de données en version ${databaseVersion}, plus récente que cette version de l’application (version ${latestKnownVersion} au plus) : une version plus récente l’a déjà migrée. ` +
  'Démarrage refusé pour ne pas l’abîmer : réinstallez la version plus récente, ou restaurez la sauvegarde prise avant sa mise à jour (README.md, section « Exploitation »).';
