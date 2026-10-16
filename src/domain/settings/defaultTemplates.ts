import type { Family } from '../catalog/families.js';
import type { MessageTemplate } from './types.js';

const GERMAN_TEMPLATE: MessageTemplate = {
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

const ITALIAN_TEMPLATE: MessageTemplate = {
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

const AMERICAN_TEMPLATE: MessageTemplate = {
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

const FRENCH_TEMPLATE: MessageTemplate = {
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

export const DEFAULT_TEMPLATES: Readonly<Record<Family, MessageTemplate>> = {
  allemandes: GERMAN_TEMPLATE,
  italiennes: ITALIAN_TEMPLATE,
  americaines: AMERICAN_TEMPLATE,
  francaises: FRENCH_TEMPLATE,
  autres: { variants: [] },
};
