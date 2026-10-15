import type { TemplateWarning } from '../messaging/lint.js';

export const TEMPLATE_WARNING_TEXTS: Readonly<Record<TemplateWarning, string>> = {
  longDash: 'Contient un tiret long (— ou –) : à remplacer par une virgule ou un point.',
  emoji: 'Contient un émoji.',
  bulletList: 'Contient une liste à puces.',
  stockPhrase: "Formule toute faite repérée (« n'hésitez pas », « je me permets »…), à reformuler.",
  noWayToBeReached: "Aucun moyen de vous joindre dans le message : la loi impose une coordonnée valable pour demander l'arrêt des envois.",
  noOptOutSentence:
    "Le message ne dit pas que vous n'insisterez pas si le vendeur ne répond pas : c'est la phrase qui vous met en règle quand vous contactez un particulier.",
};
