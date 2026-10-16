export const vapidSubject = (contactEmail: string, publicAddress: string): string =>
  contactEmail ? `mailto:${contactEmail}` : publicAddress;
