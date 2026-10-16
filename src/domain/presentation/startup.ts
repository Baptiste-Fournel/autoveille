export const firstSignInText = (setupCodeConfigured: boolean): string =>
  setupCodeConfigured
    ? 'Première connexion : ouvrez l’application et saisissez le code SETUP_CODE pour choisir le mot de passe.'
    : 'Première connexion : ouvrez l’application depuis cette machine pour choisir le mot de passe.';

export const DEMO_LOADED_TEXT = 'Données de démonstration chargées (DEMO=1).';

export const scheduledPassFailedLog = (error: string): string => `lecture planifiée en échec : ${error}`;

export const sessionCleanupFailedLog = (error: string): string => `nettoyage des sessions en échec : ${error}`;
