import type { SettingsDto, SettingsResponse } from '../../../src/shared/api';

const GERMAN_VARIANT = `Bonjour,

Je viens de tomber sur votre {modele} {annee} sur {site}. Je suis {prenom}, je tiens {concession} à {ville_concession}.

Vous pouvez m'appeler au {telephone} ou me répondre ici. Si ça ne vous intéresse pas, pas de souci, je ne reviendrai pas vers vous.

{prenom} {nom}
{concession}`;

const GERMAN_SECOND_VARIANT = `Bonjour,

Votre {modele} {annee} sur {site} a retenu mon attention. Je suis {prenom}, de {concession} à {ville_concession}.

Mon numéro, c'est le {telephone}. Si vous préférez vendre par vous-même, aucun problème, je ne vous relancerai pas.

{prenom} {nom}
{concession}`;

const ITALIAN_VARIANT = `Bonjour,

Votre {marque} {modele} m'a tout de suite tapé dans l'œil. Je suis {prenom}, de {concession} à {ville_concession}.

Je suis joignable au {telephone}. Si vous n'êtes pas vendeur à un professionnel, je ne vous relancerai pas.

{prenom} {nom}`;

export const DEALER_SETTINGS: SettingsDto = {
  dealer: { firstName: 'Julien', lastName: 'Marchand', company: 'Autos du Sud-Ouest', city: 'Bordeaux', phone: '06 12 34 56 78' },
  zone: { city: 'Bordeaux', postalCode: '33000', lat: 44.84, lon: -0.58, radiusKm: 150 },
  maxKm: 100000,
  privateOnly: true,
  specialOnly: true,
  families: {
    allemandes: {
      enabled: true,
      brands: ['Porsche', 'Mercedes-Benz', 'BMW', 'Audi', 'Alpina'],
      known: ['Porsche', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen', 'Alpina', 'Ruf', 'Wiesmann', 'Opel', 'Smart'],
      minPrice: 40000,
      maxYear: 1995,
      keywords: ['911', 'GT3', 'AMG', 'M3', 'RS6'],
    },
    italiennes: {
      enabled: true,
      brands: ['Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo'],
      known: ['Ferrari', 'Lamborghini', 'Maserati', 'Pagani', 'Alfa Romeo', 'Lancia', 'Fiat'],
      minPrice: 30000,
      maxYear: 1995,
      keywords: ['Ferrari', 'Delta Integrale', 'Giulia GT'],
    },
    americaines: {
      enabled: true,
      brands: ['Ford', 'Chevrolet', 'Dodge'],
      known: ['Ford', 'Chevrolet', 'Dodge', 'Cadillac', 'Jeep'],
      minPrice: 30000,
      maxYear: 1985,
      keywords: ['Mustang', 'Corvette', 'Camaro'],
    },
    francaises: {
      enabled: true,
      brands: ['Alpine'],
      known: ['Alpine', 'Peugeot', 'Renault', 'Citroën'],
      minPrice: 30000,
      maxYear: 1990,
      keywords: ['Alpine A110', '205 GTI', 'Clio V6'],
    },
    autres: { enabled: false, brands: [], known: [], minPrice: 0, maxYear: 0, keywords: [] },
  },
  templates: {
    allemandes: { variants: [GERMAN_VARIANT, GERMAN_SECOND_VARIANT] },
    italiennes: { variants: [ITALIAN_VARIANT] },
    americaines: { variants: [GERMAN_VARIANT] },
    francaises: { variants: [GERMAN_VARIANT] },
    autres: { variants: [GERMAN_VARIANT] },
  },
  notifications: { push: true, telegramToken: '', telegramChatId: '' },
  imap: { host: 'imap.gmail.com', port: 993, user: 'alertes.autosdusudouest@gmail.com', pass: '••••••••', mailbox: 'INBOX' },
  httpSites: [],
  alertsDone: { leboncoin: true },
  alerts: {},
};

export const MESSAGE_VARIABLES: Readonly<Record<string, string>> = {
  marque: 'la marque (Porsche)',
  modele: 'le modèle (911 Carrera S)',
  annee: "l'année de l'annonce",
  km: 'le kilométrage',
  prix: 'le prix affiché',
  ville: 'la ville du vendeur',
  site: "le site où l'annonce est parue",
  distance: 'la distance en km avec la concession',
  prenom: 'votre prénom',
  nom: 'votre nom',
  concession: 'le nom de la concession',
  ville_concession: 'la ville de la concession',
  telephone: 'votre téléphone',
};

export const dealerSettings = (settings: SettingsDto = DEALER_SETTINGS): SettingsResponse => ({
  settings,
  variables: MESSAGE_VARIABLES,
  families: [
    { key: 'allemandes', label: 'Allemandes' },
    { key: 'italiennes', label: 'Italiennes' },
    { key: 'americaines', label: 'Américaines' },
    { key: 'francaises', label: 'Françaises' },
  ],
});
