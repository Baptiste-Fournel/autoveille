import type { SiteKey } from '../sites/catalog.js';

export const SITE_ALERT_HELP: Readonly<Record<SiteKey, string>> = {
  leboncoin:
    'Faites une recherche dans Véhicules > Voitures avec vos critères (marque, rayon autour de la ville, kilométrage, vendeur particulier), puis « Sauvegarder la recherche » et activez l’alerte par email.',
  lacentrale:
    'Lancez une recherche avec vos critères, puis « Créer une alerte » (compte gratuit) et choisissez la réception par email à chaque nouvelle annonce.',
  autoscout24:
    'Après une recherche, utilisez « Sauver la recherche », puis dans Mon AutoScout24 > Recherches sauvegardées, activez « Alertez-moi par e-mail » (il est désactivé par défaut).',
  paruvendu: 'Depuis la liste de résultats, cliquez « Créer une alerte » et renseignez l’adresse email dédiée.',
  largus: 'Après une recherche, « Créer une alerte » puis choisissez la fréquence « dès qu’une annonce est publiée ».',
  'ouestfrance-auto': 'Sauvegardez votre recherche et activez l’alerte email.',
  'annonces-automobile': 'Depuis une recherche, créez une alerte email avec vos critères.',
  leparking:
    'Leparking est un moteur de recherche qui agrège d’autres sites : utile pour couvrir d’un coup les petits sites. Créez une alerte sur une recherche sauvegardée.',
};
