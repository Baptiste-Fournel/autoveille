export const HTTP_SITE_ADDRESS_MISSING = 'Indiquez l’adresse de la page de résultats.';

export const INVALID_SITE_ADDRESS = 'Adresse invalide.';

export const ROBOTS_DISALLOW_PAGE =
  'Le robots.txt du site interdit la lecture automatique de cette page. Utilisez l’alerte email du site à la place.';

export const ANTI_BOT_PAGE = 'Le site présente une page de vérification anti-robot. Utilisez l’alerte email du site à la place.';

export const siteRefusedText = (status: number): string =>
  `Le site refuse les lectures automatiques (HTTP ${status}). Utilisez l’alerte email du site à la place.`;

export const unexpectedStatusText = (status: number): string => `Réponse inattendue du site (HTTP ${status}).`;

export const siteUnreachableText = (message: string): string => `Site injoignable (${message}).`;

export const READ_FROM_STRUCTURED_DATA = 'données structurées';

export const READ_FROM_LINKS = 'lecture des liens';

export const listingsReadText = (count: number, method: string): string => `${count} annonce(s) lue(s) (${method}).`;

export const httpSitePassDetail = (readingDetail: string, matched: number): string =>
  `${readingDetail} ${matched} nouvelle(s) correspondant aux réglages.`;
