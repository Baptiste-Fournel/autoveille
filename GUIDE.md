# AutoVeille, mode d'emploi

AutoVeille surveille les sites d'annonces et vous prévient quand un particulier met en vente une voiture qui vous intéresse, avec un message déjà rédigé dans votre voix. Vous l'ouvrez, vous collez, vous envoyez. Dix secondes par annonce. Rien n'est envoyé sans vous.

## Comment ça marche, en deux phrases

Les sites d'annonces (Leboncoin, La Centrale, AutoScout24, ParuVendu) envoient eux-mêmes leurs nouvelles annonces par email quand on y crée une alerte. AutoVeille lit une boîte Gmail réservée à ces alertes toutes les deux minutes, reconnaît chaque voiture (marque, modèle, année, kilométrage, prix, ville), applique vos filtres, écrit le message et vous notifie.

## Mise en route, une seule fois (un quart d'heure)

L'écran Annonces affiche une carte **Mise en route** avec ces étapes, cochées au fur et à mesure ; elle disparaît quand tout est fait.

1. **Ouvrir l'application** à l'adresse fournie, choisir un mot de passe. Sur le téléphone, faire ensuite « Ajouter à l'écran d'accueil » pour l'avoir comme une appli.
2. **Réglages** : prénom, nom, concession, ville, téléphone (ils remplissent les messages). Ville de référence et rayon. Kilométrage maximum. Vérifier les familles de marques activées.
3. **Sites, boîte mail** : créer une adresse Gmail dédiée (par exemple alertes.nomdelaconcession@gmail.com). Dans le compte Google : Sécurité, activer la validation en deux étapes, puis « Mots de passe des applications », créer un mot de passe nommé AutoVeille et le coller dans l'application. Tester la connexion, enregistrer.
4. **Sites, les alertes** : pour chacun des quatre sites, « Créer l'alerte » ouvre une recherche pré-remplie, volontairement plus large que vos réglages (150 km, 150 000 km, particuliers, toutes marques) : c'est AutoVeille qui trie, et ce qu'elle écarte reste consultable. Sur le site, « créer une alerte » vers l'adresse Gmail dédiée, en réception immédiate quand c'est proposé. Dès que le site confirme l'alerte par email, elle apparaît dans l'application avec ses critères, et un bouton « Modifier l'alerte sur le site » mène directement à la page où la changer. Si une alerte est plus étroite que vos réglages, l'application le signale.
5. **Notifications** : « Activer » dans la carte Mise en route, ou dans Réglages, sur le téléphone (après l'ajout à l'écran d'accueil sur iPhone). « Envoyer un test » pour vérifier.

## Au quotidien

1. Une notification arrive : « Nouvelle annonce : Porsche 911 Carrera S, 2015, 42 000 km, 89 900 €, Mérignac, à 12 km ».
2. Dans l'écran **Annonces**, la voiture est en haut, avec le message proposé, modifiable.
3. **Ouvrir l'annonce et copier le message** : l'annonce s'ouvre sur le site, le message est copié. Le coller dans le formulaire de contact du site, envoyer.
4. Revenir dans AutoVeille, répondre **Oui, envoyé**. L'annonce passe dans « Contactées ». Quand le vendeur répond : **Le vendeur a répondu**.

Pas intéressé : **Ignorer**. Un vendeur demande à ne plus être sollicité : **Ne plus contacter**, il est mis de côté définitivement.

Un doigt qui glisse : chaque changement affiche « Annuler » pendant quelques secondes, et une annonce passée dans « Contactées » par erreur a un bouton **Pas encore contactée** qui la remet à traiter.

Toucher la photo ou le titre d'une annonce ouvre sa **fiche** : grande photo, caractéristiques, texte de l'annonce tel que reçu, message modifiable, et une **note** pour vous (ce que le vendeur a dit, un prix, quand rappeler), visible ensuite sur la carte. Le bouton principal reste au bas de l'écran pendant la lecture.

Dans « Contactées », chaque carte indique depuis combien de jours le vendeur a été contacté ; dans « Ont répondu », depuis quand. Une ligne en haut de l'écran résume les sept derniers jours : annonces retenues, contactées, réponses.

La date affichée sur une annonce est celle de sa publication sur le site (« publiée hier à 10:02 ») ; les annonces sont classées de la plus récente à la plus ancienne. Un champ de recherche filtre par modèle, marque ou ville, et le bouton **Filtres** trie (plus récentes, prix, distance, kilométrage) et restreint par famille, par site, par prix et par distance, à la barre. Les choix restent mémorisés sur l'appareil.

L'icône soleil / lune en haut de l'écran bascule entre mode clair et mode sombre. Dans Réglages > Affichage, « Comme l'appareil » fait suivre le réglage du téléphone.

Plusieurs annonces à traiter : **Traiter en rafale**. Elles défilent une par une : « Ouvrir l'annonce et copier le message », coller, envoyer, revenir ; l'application demande « Message envoyé ? » et passe à la suivante. Dix annonces se traitent en une minute, et chaque envoi reste le vôtre.

Une annonce dont le prix baisse ou qui est republiée garde son état ; une étiquette « Prix baissé » ou « Republiée » apparaît. Quand le prix baisse sur une voiture encore en jeu (à traiter ou contactée), une notification « Prix baissé » prévient : c'est souvent le bon moment.

**Écartées par les filtres** mérite un coup d'œil de temps en temps : les alertes des sites étant larges, une bonne affaire peut s'y cacher. Les annonces y sont regroupées par raison (marques suivies, trop loin, trop de kilomètres, ni supercar ni collection, vendeur pro, autres marques) ; « Garder quand même » remet une annonce à traiter.

## Réglages

Le compteur en bas (« 12 annonces sur 7 jours ») montre l'effet de chaque réglage avant même d'enregistrer.

- **Zone** : ville de référence et rayon. Kilométrage maximum. « Particuliers uniquement » écarte les professionnels quand le site le précise.
- **Supercar et collection uniquement** : quand c'est activé, une voiture est gardée si elle dépasse un prix plancher, ou si elle est assez ancienne, ou si son modèle est dans les mots-clés (911, GT3, AMG, M3, RS6, Mustang, Alpine A110, 205 GTI…). Réglable famille par famille, mots-clés modifiables.
- **Marques suivies** : quatre familles (allemandes, italiennes, américaines, françaises). Toucher une marque pour l'activer ou la désactiver, en ajouter une si elle manque.

## Messages

Un message par famille, avec plusieurs variantes tirées au hasard pour ne pas envoyer toujours le même texte. Les mots entre accolades (`{modele}`, `{annee}`, `{km}`, `{ville}`, `{telephone}`…) sont remplacés automatiquement ; l'aperçu montre le résultat sur une vraie annonce. Écrire comme on parle. Toujours garder son téléphone et la phrase qui dit qu'on n'insistera pas : c'est ce qui met en règle quand on contacte un particulier.

## Si quelque chose ne va pas

- Aucune annonce n'arrive : dans **Sites**, vérifier que la boîte mail est « Fonctionne » et que le journal « Derniers emails reçus » montre des emails. S'il est vide, les alertes ne sont pas créées sur les sites ou n'arrivent pas sur la bonne adresse.
- Un email est reçu mais « aucune annonce reconnue » : le site a changé le format de ses emails. Le transmettre à la personne qui maintient l'outil (télécharger l'email en .eml depuis Gmail).
- Une voiture a été écartée à tort : onglet « Écartées par les filtres », la raison est affichée, « Garder quand même » la remet dans la file.
- Après une mise à jour de l'application : rien n'est perdu (annonces, statuts, notes, réglages vivent sur le serveur, et une copie de la base est faite avant chaque mise à jour). Dans **Sites**, « Tout relire » relit toute la boîte mail ; les annonces connues sont complétées, pas dupliquées.
- Les photos de certains sites (La Centrale) ne s'affichent que sur le site lui-même : l'application montre alors une icône, et la fiche propose « Photos sur le site ».
- Un site annonce « 61 nouvelles annonces » mais l'application n'en reçoit que 3 : certains sites (La Centrale) n'envoient par email qu'un aperçu de la liste. L'onglet **Sites** le signale, avec le lien vers le reste de la liste sur le site, et une notification prévient quand l'écart est important. L'application ne peut pas aller lire ces pages à votre place (les sites s'y opposent) ; des alertes plus ciblées sur le site (par marque, avec un prix plancher) réduisent l'écart.
- Les emails « baisses de prix », « toujours intéressé ? » ou récapitulatifs sont lus aussi : une baisse de prix met à jour l'annonce connue ; une annonce inconnue est ajoutée sans date de publication (le site ne la donne pas), avec la mention « date de publication non fournie ».

## Ce que l'application ne fait pas

Elle n'envoie jamais un message à votre place. Elle ne force pas l'accès aux sites qui refusent la lecture automatique. Elle ne stocke pas les coordonnées des vendeurs, seulement le lien vers leur annonce.
