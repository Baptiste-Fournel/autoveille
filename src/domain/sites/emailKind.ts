export type EmailKind = 'new' | 'price_drop' | 'reminder' | 'recap' | 'other';

type DetectedKind = Exclude<EmailKind, 'other'>;

const SUBJECT_WORDING: readonly (readonly [DetectedKind, RegExp])[] = [
  ['price_drop', /baisses? de prix|prix en baisse|nouveau prix|price drop/i],
  ['reminder', /toujours int[ée]ress|encore disponible|vous avez consult|n[’']oubliez pas|toujours disponible/i],
  ['recap', /r[ée]capitulatif|r[ée]sum[ée]|hebdo|de la semaine|digest|s[ée]lection|recommand|vous avez manqu|coups? de c[œo]ur/i],
  [
    'new',
    /nouvelle?s? annonces?|nouveaux? v[ée]hicules?|nouveaux? r[ée]sultats?|nouvelle?s? offres?|correspond(ent)? [àa] (votre|ta) recherche|nouvelle annonce/i,
  ],
];

const KINDS_ABOUT_OLDER_ADS: readonly EmailKind[] = ['price_drop', 'reminder', 'recap'];

const ANNOUNCED_COUNT = /(\d{1,4})\s+nouve(?:aux?|lles?)\s+(?:annonces?|v[ée]hicules?|r[ée]sultats?|offres?)/i;

export function classifyEmail(subject?: string): EmailKind {
  if (!subject) {
    return 'other';
  }
  return SUBJECT_WORDING.find(([, wording]) => wording.test(subject))?.[0] ?? 'other';
}

export function isDigestOfOlderAds(subject?: string): boolean {
  return KINDS_ABOUT_OLDER_ADS.includes(classifyEmail(subject));
}

export function publicationDateFromEmail(subject: string, emailDate: string | undefined): string | undefined {
  return isDigestOfOlderAds(subject) ? undefined : emailDate;
}

export function announcedCount(subject?: string): number | undefined {
  const match = subject ? ANNOUNCED_COUNT.exec(subject) : null;
  return match ? Number(match[1]) : undefined;
}
