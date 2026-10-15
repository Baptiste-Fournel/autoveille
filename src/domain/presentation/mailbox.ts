export const MAILBOX_NOT_CONFIGURED = 'Boîte mail non configurée.';

export const MAILBOX_CREDENTIALS_MISSING = 'Adresse ou mot de passe d’application manquant.';

export const MAILBOX_AUTHENTICATION_REFUSED =
  'Connexion à la boîte mail refusée : vérifiez l’adresse et le mot de passe d’application (Gmail exige un mot de passe d’application, pas le mot de passe habituel).';

export const mailboxConnectedText = (messageCount: number): string => `Connexion réussie, ${messageCount} email(s) dans la boîte.`;

export const mailboxUnreachableText = (serverMessage: string): string => `Serveur mail injoignable (${serverMessage}).`;

export const mailboxReadErrorText = (serverMessage: string): string => `Erreur de lecture de la boîte mail : ${serverMessage}`;

export const emailErrorText = (uid: number, message: string): string => `uid ${uid}: ${message}`;

export interface MailboxPassCounts {
  readonly processed: number;
  readonly listings: number;
  readonly matched: number;
  readonly errors: readonly string[];
}

export const mailboxPassDetail = ({ processed, listings, matched, errors }: MailboxPassCounts): string =>
  `${processed} email(s) lu(s), ${listings} annonce(s), ${matched} nouvelle(s) correspondant aux réglages${errors.length ? ` ; ${errors.length} erreur(s) : ${errors[0]}` : ''}`;

export const emailsToProcessLog = (count: number): string => `${count} email(s) à traiter`;

export const alertConfirmedLog = (site: string, criteria: string): string => `alerte ${site} confirmée par email : ${criteria}`;

export const truncatedEmailLog = (siteName: string, announced: number, received: number): string =>
  `${siteName} : email tronqué, ${announced} annonces annoncées, ${received} lue(s)`;

export const truncatedDigestNotificationFailedLog = (error: string): string => `notification résumé tronqué : ${error}`;

export const mailboxPassLog = (detail: string): string => `email: ${detail}`;
