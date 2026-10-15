import type { MessageVariable } from '../messaging/variables.js';

export const VARIABLE_HELP: Readonly<Record<MessageVariable, string>> = {
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
