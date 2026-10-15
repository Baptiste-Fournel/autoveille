export type SiteKey =
  | 'leboncoin'
  | 'lacentrale'
  | 'autoscout24'
  | 'paruvendu'
  | 'largus'
  | 'ouestfrance-auto'
  | 'annonces-automobile'
  | 'leparking';

export interface SiteDef {
  readonly key: SiteKey;
  readonly label: string;
  readonly hosts: readonly string[];
  readonly listingPathPatterns: readonly RegExp[];
  readonly alertSenderDomains: readonly string[];
  readonly manageAlertUrl?: string;
  readonly photoHosts: readonly string[];
}

export const SITES: readonly SiteDef[] = [
  {
    key: 'leboncoin',
    label: 'Leboncoin',
    hosts: ['leboncoin.fr'],
    alertSenderDomains: ['leboncoin.fr'],
    listingPathPatterns: [/^\/ad\/[a-z_-]+\/(\d{6,})/i, /^\/voitures\/(\d{6,})\.htm/i, /^\/vi\/(\d{6,})/i],
    photoHosts: ['img.leboncoin.fr'],
    manageAlertUrl: 'https://www.leboncoin.fr/mes-recherches',
  },
  {
    key: 'lacentrale',
    label: 'La Centrale',
    hosts: ['lacentrale.fr'],
    alertSenderDomains: ['lacentrale.fr'],
    listingPathPatterns: [/^\/auto-occasion-annonce-(\d{6,})\.html/i, /^\/annonce[^/]*\/(\d{6,})/i],
    photoHosts: ['pictures.lacentrale.fr'],
    manageAlertUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
  },
  {
    key: 'autoscout24',
    label: 'AutoScout24',
    hosts: ['autoscout24.fr', 'autoscout24.com'],
    alertSenderDomains: ['autoscout24.fr', 'autoscout24.com'],
    listingPathPatterns: [
      /^\/(?:annonces|offres)\/(?:.*-)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      /^\/offres\/([0-9a-f-]{20,})/i,
    ],
    photoHosts: ['prod.pictures.autoscout24.net', 'pictures.autoscout24.net'],
    manageAlertUrl: 'https://www.autoscout24.fr/account/searches',
  },
  {
    key: 'paruvendu',
    label: 'ParuVendu',
    hosts: ['paruvendu.fr'],
    alertSenderDomains: ['paruvendu.fr'],
    listingPathPatterns: [/^\/a\/voiture-occasion\/[^/]+\/[^/]+\/([A-Za-z0-9]{6,})/i, /^\/a\/[^/]+\/.*\/([A-Za-z0-9]{8,})\/?$/i],
    photoHosts: ['media.paruvendu.fr', 'img.paruvendu.fr'],
    manageAlertUrl: 'https://www.paruvendu.fr/utilisateurparticulierfo/default/accueilCompte/',
  },
  {
    key: 'largus',
    label: 'L’argus',
    hosts: ['largus.fr', 'occasion.largus.fr'],
    alertSenderDomains: ['largus.fr'],
    listingPathPatterns: [/^\/voiture-occasion\/.*?(\d{6,})/i, /^\/annonce.*?(\d{6,})/i],
    photoHosts: [],
  },
  {
    key: 'ouestfrance-auto',
    label: 'Ouest-France Auto',
    hosts: ['ouestfrance-auto.com'],
    alertSenderDomains: ['ouestfrance-auto.com', 'ouest-france.fr'],
    listingPathPatterns: [/^\/voiture-occasion\/.*?(\d{6,})/i],
    photoHosts: [],
  },
  {
    key: 'annonces-automobile',
    label: 'Annonces-Automobile',
    hosts: ['annonces-automobile.com'],
    alertSenderDomains: ['annonces-automobile.com'],
    listingPathPatterns: [/^\/annonce[s]?\/.*?(\d{5,})/i, /^\/.*-(\d{6,})\.html?$/i],
    photoHosts: [],
  },
  {
    key: 'leparking',
    label: 'Leparking',
    hosts: ['leparking.fr'],
    alertSenderDomains: ['leparking.fr'],
    listingPathPatterns: [/^\/voiture-occasion\/.*?([0-9a-f]{8,}|\d{6,})/i],
    photoHosts: [],
  },
];

const belongsTo = (domain: string, parent: string): boolean => domain === parent || domain.endsWith(`.${parent}`);

export function siteForHost(host: string): SiteDef | undefined {
  const domain = host.toLowerCase();
  return SITES.find((site) => site.hosts.some((siteHost) => belongsTo(domain, siteHost)));
}

export function siteForSender(address: string): SiteDef | undefined {
  const domain = address.toLowerCase().split('@')[1] ?? '';
  return SITES.find((site) => site.alertSenderDomains.some((senderDomain) => belongsTo(domain, senderDomain)));
}

export function siteLabel(key: string): string {
  return SITES.find((site) => site.key === key)?.label ?? key;
}
