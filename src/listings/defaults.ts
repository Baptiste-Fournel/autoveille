import type { Family, FamilyRules, MessageTemplate, Settings } from '../types.js';
import { brandsOfFamily } from './brands.js';

const KEYWORDS: Record<Family, string[]> = {
  allemandes: [
    '911', 'GT3', 'GT2', 'Turbo S', 'Carrera', 'Targa', 'Spyder', 'GT4', '918', '959', '928', '944 Turbo', '968', '356', '964', '993', '996', '997', '991', '992',
    'AMG', 'SLS', 'SLR', 'SL 55', 'SL 63', 'SL 65', 'G 63', 'Black Series', 'C 63', 'E 63', '190 Evo', '300 SL', '280 SL', 'Pagode', 'W113', 'W111', 'W124 Cabriolet',
    'M2', 'M3', 'M4', 'M5', 'M6', 'M8', 'Z3 M', 'Z4 M', 'Z8', '1M', 'Alpina', 'E30', 'E36', 'E46', '2002', '3.0 CSL', 'Z1', '850',
    'RS2', 'RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'R8', 'TT RS', 'Ur-Quattro', 'Quattro Coupé', 'S8',
    'Golf GTI', 'Golf R', 'Corrado', 'Scirocco', 'Karmann', 'Coccinelle', 'Combi', 'Wiesmann', 'Ruf',
  ],
  italiennes: [
    'Ferrari', 'Lamborghini', 'Maserati', 'Pagani', 'De Tomaso', '4C', '8C', 'GTV6', 'Montreal', 'SZ', 'Quadrifoglio', 'Giulia GT', 'Spider Duetto', 'Delta Integrale', 'Stratos', 'Dino', '695 Biposto', '124 Spider',
  ],
  americaines: [
    'Mustang', 'Corvette', 'Camaro', 'Challenger', 'Charger', 'Viper', 'Shelby', 'GT500', 'GT350', 'Hellcat', 'Demon', 'Cadillac', 'Eldorado', 'Thunderbird', 'Bel Air', 'Impala', 'El Camino', 'Firebird', 'Trans Am', 'GTO', 'Chevelle', 'Nova', 'Road Runner', 'Barracuda', 'Cuda', 'Hemi', 'Pontiac', 'Buick', 'Oldsmobile', 'Continental', 'Ford GT', 'Raptor', 'Bronco', 'Hummer', 'Wrangler', 'Grand Cherokee SRT', 'Escalade', 'Roadster',
  ],
  francaises: [
    'Alpine', 'Bugatti', 'A110', 'A310', 'GTA', 'V6 Turbo', 'RS', 'R.S.', 'Clio V6', 'R5 Turbo', '5 Turbo', '205 GTI', '309 GTI', '106 Rallye', '106 S16', 'Saxo VTS', '205 T16', 'Mégane RS', 'Megane RS', 'Trophy', 'Williams', 'Cup', 'DS 21', 'DS 23', 'SM', 'CX', 'Traction', '2CV', 'Méhari', 'Mehari', '4L', 'Dauphine', 'Caravelle', 'Floride', 'Matra', 'Murena', 'Bagheera', 'Venturi', 'Facel', 'BX 4TC', 'Mi16', 'Turbo 16', 'RCZ R', '308 GTI', '208 GTI', 'Spider', 'Gordini', 'Alpine A610', 'Safrane Biturbo',
  ],
  autres: [],
};

const DEFAULT_ENABLED: Record<Family, string[]> = {
  allemandes: ['Porsche', 'Mercedes-Benz', 'BMW', 'Audi', 'Alpina'],
  italiennes: ['Ferrari', 'Lamborghini', 'Maserati', 'Pagani', 'Alfa Romeo', 'Lancia', 'De Tomaso'],
  americaines: ['Ford', 'Chevrolet', 'Dodge', 'Cadillac', 'Chrysler', 'Pontiac', 'Buick', 'Lincoln', 'Plymouth', 'Oldsmobile', 'Shelby', 'Hummer', 'Jeep'],
  francaises: ['Alpine', 'Bugatti', 'Renault', 'Peugeot', 'Citroën', 'Venturi', 'Matra', 'Facel Vega'],
  autres: [],
};

const RULES: Record<Family, { minPrice: number; maxYear: number }> = {
  allemandes: { minPrice: 40_000, maxYear: 1995 },
  italiennes: { minPrice: 30_000, maxYear: 1995 },
  americaines: { minPrice: 15_000, maxYear: 1995 },
  francaises: { minPrice: 50_000, maxYear: 1985 },
  autres: { minPrice: 0, maxYear: 0 },
};

function familyRules(family: Family): FamilyRules {
  return {
    enabled: family !== 'autres',
    brands: [...DEFAULT_ENABLED[family]],
    known: brandsOfFamily(family),
    minPrice: RULES[family].minPrice,
    maxYear: RULES[family].maxYear,
    keywords: [...KEYWORDS[family]],
  };
}

const T_ALLEMANDES: MessageTemplate = {
  variants: [
    `Bonjour,

Je viens de tomber sur votre {modele} {annee} sur {site}. Je suis {prenom}, je tiens {concession} à {ville_concession}, on fait essentiellement de l'allemande sportive et quelques autos de collection. Une {modele} avec {km} km, c'est le genre de voiture qu'on nous demande régulièrement.

Si la vente traîne ou si vous en avez assez des gens qui viennent pour négocier à moitié prix, on peut en parler. Soit je vous fais une proposition de reprise ferme, soit on la met en dépôt chez nous, exposée en showroom, et vous êtes payé à la vente. Dans les deux cas vous ne vous occupez plus de rien.

Vous pouvez m'appeler au {telephone} ou me répondre ici. Si ça ne vous intéresse pas, pas de souci, je ne reviendrai pas vers vous.

{prenom} {nom}
{concession}`,
    `Bonjour,

Votre {modele} {annee} sur {site} a retenu mon attention. Je suis {prenom}, de {concession} à {ville_concession}. On vend ce type d'auto toute l'année et on a en ce moment des clients qui attendent précisément une {modele} dans cette tranche de kilométrage.

Deux options si ça vous parle : une reprise avec un prix ferme sous quelques jours, ou un dépôt-vente chez nous où la voiture est préparée, exposée et vendue par nos soins, avec un règlement à la vente. Vous ne gérez ni les visites ni les acheteurs qui ne viennent pas.

Mon numéro, c'est le {telephone}. Si vous préférez vendre par vous-même, aucun problème, je ne vous relancerai pas.

{prenom} {nom}
{concession}`,
    `Bonjour,

J'ai vu votre annonce pour une {modele} {annee} sur {site}. Je suis {prenom}, je dirige {concession} à {ville_concession}, à {distance} km de chez vous. Les {marque} sportives et de collection, c'est notre quotidien.

Je ne vais pas vous faire de grande phrase : si vous voulez vendre vite et au bon prix sans vous occuper de rien, je peux soit vous la reprendre, soit la vendre pour vous en dépôt. On en parle dix minutes au téléphone et vous décidez.

Je suis au {telephone}. Si ce n'est pas d'actualité, ne vous embêtez pas à répondre, je n'insisterai pas.

{prenom} {nom}
{concession}`,
  ],
};

const T_ITALIENNES: MessageTemplate = {
  variants: [
    `Bonjour,

Je viens de voir votre {modele} {annee} sur {site}. Je suis {prenom}, je tiens {concession} à {ville_concession}. Les italiennes de ce niveau, on en vend peu mais on les vend bien, parce qu'on connaît les gens qui les cherchent et qu'ils ne traînent pas sur les sites d'annonces.

Une {modele} se vend rarement bien au premier venu : il faut un dossier complet, un suivi vérifié, et surtout le bon acheteur. C'est ce qu'on fait. Si vous le souhaitez, je vous fais une proposition de reprise ferme, ou on la met en dépôt chez nous et vous êtes réglé à la vente.

Vous pouvez me joindre au {telephone}. Si vous n'êtes pas vendeur dans ces conditions, pas de problème, je n'insisterai pas.

{prenom} {nom}
{concession}`,
    `Bonjour,

Votre {modele} {annee} sur {site} m'a fait réagir. Je suis {prenom}, de {concession} à {ville_concession}. On travaille régulièrement des {marque} et on a des clients qui attendent ce genre de voiture, pas des curieux.

Si vous voulez éviter les mois d'annonce et les visites pour rien, je peux vous proposer une reprise ou une vente en dépôt chez nous, exposée et vendue par nos soins. Dix minutes au téléphone suffisent pour voir si ça a du sens.

Mon numéro, c'est le {telephone}. Si vous préférez vendre seul, aucun souci, je ne reviendrai pas vers vous.

{prenom} {nom}
{concession}`,
  ],
};

const T_AMERICAINES: MessageTemplate = {
  variants: [
    `Bonjour,

J'ai vu votre {modele} {annee} sur {site}. Je suis {prenom}, de {concession} à {ville_concession}. Les américaines, on en vend depuis des années et on sait à qui les proposer, ce qui n'est pas le cas de tout le monde dans la région. Sur les sites généralistes ces autos mettent du temps à partir parce que les acheteurs sérieux sont peu nombreux et qu'ils ne cherchent pas là.

On a une clientèle qui attend précisément ce type de véhicule. Si vous voulez, je regarde votre auto, je vous dis ce qu'elle vaut vraiment sur ce marché, et on voit ensemble si on la reprend ou si on la vend pour vous.

Mon numéro, c'est le {telephone}. Si vous préférez vendre seul, aucun problème, je n'insisterai pas.

{prenom} {nom}
{concession}`,
    `Bonjour,

Votre {modele} {annee} sur {site} est le genre d'auto qu'on cherche. Je suis {prenom}, je tiens {concession} à {ville_concession}, et l'américaine c'est un peu notre marque de fabrique : on en a toujours quelques-unes en exposition et des clients qui nous appellent pour ça.

Si la vente n'avance pas comme vous voulez, je peux vous faire une offre de reprise ou la prendre en dépôt chez nous. Dans les deux cas vous n'avez plus à gérer les visites ni les négociations.

Je suis joignable au {telephone}. Si ce n'est pas le moment, pas de souci, je ne vous relancerai pas.

{prenom} {nom}
{concession}`,
  ],
};

const T_FRANCAISES: MessageTemplate = {
  variants: [
    `Bonjour,

Je viens de voir votre {modele} {annee} sur {site}. Je suis {prenom}, je tiens {concession} à {ville_concession}. Les françaises sportives et de collection, on en vend régulièrement, et une {modele} dans cet état trouve preneur si elle est présentée aux bonnes personnes.

Si vous préférez ne pas gérer les visites et les propositions à la baisse, je peux vous faire une offre de reprise ferme, ou la mettre en dépôt chez nous, exposée et vendue par nos soins, avec un règlement à la vente.

Vous pouvez me joindre au {telephone} ou me répondre ici. Si vous n'êtes pas intéressé, pas de souci, je ne reviendrai pas vers vous.

{prenom} {nom}
{concession}`,
    `Bonjour,

Votre {modele} {annee} sur {site} a attiré mon attention. Je suis {prenom}, de {concession} à {ville_concession}. On a des clients qui cherchent ce modèle précis et qui ne passent pas forcément par les sites d'annonces.

Si ça vous intéresse d'en parler, je peux soit la reprendre, soit la vendre pour vous en dépôt. On en discute au téléphone quand vous voulez, au {telephone}.

Si vous préférez vendre par vous-même, aucun problème, je n'insisterai pas.

{prenom} {nom}
{concession}`,
  ],
};

export function defaultSettings(): Settings {
  return {
    dealer: { firstName: '', lastName: '', company: '', city: 'Bordeaux', phone: '' },
    zone: { city: 'Bordeaux', postalCode: '33000', lat: 44.8378, lon: -0.5792, radiusKm: 100 },
    maxKm: 100_000,
    privateOnly: true,
    specialOnly: true,
    alertsDone: {},
    alerts: {},
    families: {
      allemandes: familyRules('allemandes'),
      italiennes: familyRules('italiennes'),
      americaines: familyRules('americaines'),
      francaises: familyRules('francaises'),
      autres: familyRules('autres'),
    },
    templates: {
      allemandes: T_ALLEMANDES,
      italiennes: T_ITALIENNES,
      americaines: T_AMERICAINES,
      francaises: T_FRANCAISES,
      autres: { variants: [] },
    },
    notifications: { push: true, telegramToken: '', telegramChatId: '' },
    imap: { host: 'imap.gmail.com', port: 993, user: '', pass: '', mailbox: 'INBOX' },
    httpSites: [],
  };
}

/** Fill in anything missing from a stored settings object (after an upgrade, for example). */
/** The first version shipped example values ("Prénom", "06 00 00 00 00") as real values; they count as empty. */
const PLACEHOLDERS = new Set(['Prénom', 'Nom', 'Nom de la concession', '06 00 00 00 00']);
function withoutPlaceholders(dealer: Settings['dealer']): Settings['dealer'] {
  const clean = { ...dealer };
  for (const k of Object.keys(clean) as Array<keyof Settings['dealer']>) if (PLACEHOLDERS.has(clean[k])) clean[k] = '';
  return clean;
}

export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  const d = defaultSettings();
  if (!stored) return d;
  const out: Settings = {
    dealer: withoutPlaceholders({ ...d.dealer, ...(stored.dealer ?? {}) }),
    zone: { ...d.zone, ...(stored.zone ?? {}) },
    maxKm: stored.maxKm ?? d.maxKm,
    privateOnly: stored.privateOnly ?? d.privateOnly,
    specialOnly: stored.specialOnly ?? d.specialOnly,
    alertsDone: { ...(stored.alertsDone ?? {}) },
    alerts: { ...(stored.alerts ?? {}) },
    families: { ...d.families },
    templates: { ...d.templates },
    notifications: { ...d.notifications, ...(stored.notifications ?? {}) },
    imap: { ...d.imap, ...(stored.imap ?? {}) },
    httpSites: stored.httpSites ?? d.httpSites,
  };
  for (const f of Object.keys(d.families) as Family[]) {
    const s = stored.families?.[f];
    if (s) {
      out.families[f] = { ...d.families[f], ...s };
      // New brands added in a later version show up as "known" but stay in whatever state the user left them.
      out.families[f].known = Array.from(new Set([...d.families[f].known, ...(s.known ?? []), ...(s.brands ?? [])]));
    }
    const t = stored.templates?.[f];
    if (t && Array.isArray(t.variants)) out.templates[f] = { variants: t.variants };
  }
  return out;
}
