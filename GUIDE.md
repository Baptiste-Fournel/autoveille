# AutoVeille, mode d'emploi

AutoVeille surveille les sites d'annonces et vous prévient quand un particulier met en vente une voiture qui vous intéresse, avec un message déjà rédigé dans votre voix. Vous l'ouvrez, vous collez, vous envoyez. Dix secondes par annonce. Rien n'est envoyé sans vous.

## Comment ça marche, en deux phrases

Les sites d'annonces (Leboncoin, La Centrale, AutoScout24, ParuVendu) envoient eux-mêmes leurs nouvelles annonces par email quand on y crée une alerte. AutoVeille lit une boîte Gmail réservée à ces alertes toutes les deux minutes, reconnaît chaque voiture (marque, modèle, année, kilométrage, prix, ville), applique vos filtres, écrit le message et vous notifie.

## Mise en route, une seule fois (un quart d'heure)

1. **Ouvrir l'application** à l'adresse fournie, saisir le code de première connexion, choisir un mot de passe. Sur le téléphone, faire ensuite « Ajouter à l'écran d'accueil » pour l'avoir comme une appli.
2. **Réglages** : prénom, nom, concession, ville, téléphone (ils remplissent les messages). Ville de référence et rayon. Kilométrage maximum. Vérifier les familles de marques activées.
3. **Sources, boîte mail** : créer une adresse Gmail dédiée (par exemple alertes.nomdelaconcession@gmail.com). Dans le compte Google : Sécurité, activer la validation en deux étapes, puis « Mots de passe des applications », créer un mot de passe nommé AutoVeille et le coller dans l'application. Tester la connexion, enregistrer.
4. **Sources, créer les alertes** : pour chacun des quatre sites, ouvrir le lien de recherche proposé, vérifier les critères (toutes marques, particuliers, votre ville et votre rayon, kilométrage maximum), puis « créer une alerte » vers l'adresse Gmail dédiée, en réception immédiate si le site le propose. Une seule alerte large par site : c'est AutoVeille qui trie finement.
5. **Notifications** : dans Réglages, « Activer sur cet appareil » sur le téléphone (après l'ajout à l'écran d'accueil sur iPhone). « Envoyer un test » pour vérifier.

## Au quotidien

1. Une notification arrive : « Nouvelle annonce : Porsche 911 Carrera S, 2015, 42 000 km, 89 900 €, Mérignac, à 12 km ».
2. Dans l'écran **Annonces**, la voiture est en haut, avec le message proposé, modifiable.
3. **Ouvrir l'annonce et copier le message** : l'annonce s'ouvre sur le site, le message est copié. Le coller dans le formulaire de contact du site, envoyer.
4. Revenir dans AutoVeille, répondre **Oui, envoyé**. L'annonce passe dans « Contactées ». Quand le vendeur répond : **Le vendeur a répondu**.

Pas intéressé : **Ignorer**. Un vendeur demande à ne plus être sollicité : **Ne plus contacter**, il est mis de côté définitivement.

Toucher la photo ou le titre d'une annonce ouvre sa **fiche** : grande photo, caractéristiques, texte de l'annonce tel que reçu, message modifiable, sans quitter l'application.

Plusieurs annonces à traiter : **Traiter en rafale**. Elles défilent une par une : « Ouvrir l'annonce et copier le message », coller, envoyer, revenir ; l'application demande « Message envoyé ? » et passe à la suivante. Dix annonces se traitent en une minute, et chaque envoi reste le vôtre.

Une annonce dont le prix baisse ou qui est republiée garde son état ; une étiquette « Prix baissé » ou « Republiée » apparaît, sans nouvelle sollicitation.

## Réglages

Le compteur en bas (« 12 annonces sur 7 jours ») montre l'effet de chaque réglage avant même d'enregistrer.

- **Zone** : ville de référence et rayon. Kilométrage maximum. « Particuliers uniquement » écarte les professionnels quand le site le précise.
- **Supercar et collection uniquement** : quand c'est activé, une voiture est gardée si elle dépasse un prix plancher, ou si elle est assez ancienne, ou si son modèle est dans les mots-clés (911, GT3, AMG, M3, RS6, Mustang, Alpine A110, 205 GTI…). Réglable famille par famille, mots-clés modifiables.
- **Marques suivies** : quatre familles (allemandes, italiennes, américaines, françaises). Toucher une marque pour l'activer ou la désactiver, en ajouter une si elle manque.

## Messages

Un message par famille, avec plusieurs variantes tirées au hasard pour ne pas envoyer toujours le même texte. Les mots entre accolades (`{modele}`, `{annee}`, `{km}`, `{ville}`, `{telephone}`…) sont remplacés automatiquement ; l'aperçu montre le résultat sur une vraie annonce. Écrire comme on parle. Toujours garder son téléphone et la phrase qui dit qu'on n'insistera pas : c'est ce qui met en règle quand on contacte un particulier.

## Si quelque chose ne va pas

- Aucune annonce n'arrive : dans **Sources**, vérifier que la boîte mail est « Fonctionne » et que le journal « Derniers emails reçus » montre des emails. S'il est vide, les alertes ne sont pas créées sur les sites ou n'arrivent pas sur la bonne adresse.
- Un email est reçu mais « aucune annonce reconnue » : le site a changé le format de ses emails. Le transmettre à la personne qui maintient l'outil (télécharger l'email en .eml depuis Gmail).
- Une voiture a été écartée à tort : onglet « Écartées par les filtres », la raison est affichée, « Garder quand même » la remet dans la file.

## Ce que l'application ne fait pas

Elle n'envoie jamais un message à votre place. Elle ne force pas l'accès aux sites qui refusent la lecture automatique. Elle ne stocke pas les coordonnées des vendeurs, seulement le lien vers leur annonce.
