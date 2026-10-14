# AutoVeille

Veille d'annonces automobiles pour un concessionnaire : l'application repère les nouvelles annonces de particuliers qui correspondent à ses critères (zone, kilométrage, marques, supercar / collection), rédige pour chacune un message personnalisé dans sa voix, et le prévient sur son téléphone. Il ouvre l'annonce, colle le message, envoie. Rien n'est envoyé sans lui.

## Comment ça marche

```
sites d'annonces ──(alertes email)──► boîte Gmail dédiée ──► AutoVeille ──► notification + message prêt
sites qui autorisent la lecture ──(page de résultats, robots.txt respecté)──┘
```

1. **Sources** (`src/sources/`). La source principale est la boîte mail : chaque site envoie lui-même ses nouvelles annonces quand on y crée une alerte (une seule alerte large par site, le tri fin se fait dans l'application). `email/parse.ts` reconstitue chaque annonce à partir de l'email (lien, titre, prix, km, année, ville, type de vendeur), `email/imap.ts` lit la boîte toutes les deux minutes. `http.ts` lit en plus une page de résultats pour les sites qui l'autorisent (robots.txt vérifié, un seul essai, aucun contournement : si le site refuse, l'application le dit et renvoie vers l'alerte email).
2. **Normalisation** (`src/listings/normalize.ts`, `brands.ts`). Marque, modèle, année, km, prix et localisation sont extraits du titre et du texte. Les marques sont groupées en familles : allemandes, italiennes, américaines (Ford uniquement pour ses modèles américains), françaises.
3. **Filtres** (`src/listings/filters.ts`). Zone (distance calculée par `geo/geo.ts`, API geo.api.gouv.fr avec repli hors ligne), kilométrage maximum, particuliers, familles et marques activées, règle « supercar et collection » par famille : prix plancher **ou** année maximale **ou** mot-clé dans le titre.
4. **Dédoublonnage** (`src/pipeline.ts`). Une même voiture est reconnue sur plusieurs sites et à travers les republications (même marque, modèle, année, département, km proches). Un changement de prix ou une republication met à jour la fiche sans renvoyer de message ni de notification.
5. **Messages** (`src/messages/templates.ts`). Un gabarit par famille avec plusieurs variantes, variables `{modele}`, `{annee}`, `{km}`… remplies automatiquement ; une phrase dont une variable manque est retirée plutôt que laissée à trous. Un vérificateur signale les tirets longs, émojis et formules toutes faites.
6. **Interface** (`public/`). Application web installable (PWA) avec notifications push gratuites, sans framework ni étape de build côté client. Quatre écrans : Annonces, Réglages, Messages, Sources.

Base SQLite (`better-sqlite3`), serveur Fastify, TypeScript. Aucun service payant.

## Développement

```bash
npm install
cp .env.example .env
DEMO=1 npm run dev          # http://localhost:3000, données d'exemple, première connexion sans code depuis la machine
npm test                    # tests unitaires (parsing, filtres, dédoublonnage, messages, emails, robots.txt)
npm run check               # typage
npm run parse-email -- alerte.eml   # tester l'extraction sur un email enregistré (fichier .eml)
```

Première connexion : si `SETUP_CODE` est vide dans `.env`, la page de première connexion n'est accessible que depuis la machine elle-même (localhost). Sur un serveur, `deploy/install.sh` génère ce code.

## Calibrer l'extraction sur les vrais emails

Les gabarits d'emails des sites changent. L'écran **Sources** montre pour chaque email reçu ce qui a été extrait (ou « aucune annonce reconnue »). Pour ajuster :

- Enregistrer l'email en `.eml` depuis Gmail (menu « Télécharger le message ») et lancer `npm run parse-email -- fichier.eml`.
- Les motifs d'URL par site sont dans `src/sources/sites.ts` (`listing`), les règles de lecture de bloc dans `src/sources/email/parse.ts`. Les tests dans `parse.test.ts` donnent le format attendu ; ajouter l'email problématique comme nouveau cas.
- Les liens de suivi (click.…) sont résolus par une requête HTTP qui suit les redirections, rien d'autre.

## Déploiement (serveur gratuit ou à 4 €/mois)

Tout tient dans `deploy/` :

- `install.sh` installe Node 22, Caddy (HTTPS automatique sur `<ip>.sslip.io`, gratuit), ouvre les ports 80/443, crée le service systemd et génère le code de première connexion dans `/root/autoveille-setup.txt`.
- `cloud-init.yaml` fait la même chose automatiquement à la création d'une machine (Oracle Cloud Always Free, Hetzner, OVH…) : remplacer `REPO_URL` et `SETUP_CODE`, coller dans le champ cloud-init / user data.
- `update.sh` met à jour depuis git et redémarre.

Sur Oracle Cloud, en plus du script : autoriser les ports 80 et 443 dans la *security list* du réseau virtuel (VCN), et passer le compte en *Pay As You Go* pour éviter la récupération des machines inactives (sans frais tant qu'on reste sur les ressources Always Free).

Après l'installation : ouvrir `https://<ip>.sslip.io`, saisir le code, choisir le mot de passe. Puis dans **Sources** : relier la boîte Gmail (mot de passe d'application) et créer les alertes sur les sites ; dans **Réglages** : coordonnées, zone, marques ; sur le téléphone : installer l'application (« Ajouter à l'écran d'accueil ») et activer les notifications.

## Cadre

Les annonces appartiennent à des particuliers. L'application prépare le travail mais c'est une personne qui envoie chaque message, via le formulaire du site, avec ses coordonnées et une phrase indiquant qu'elle n'insistera pas (c'est l'indication d'opposition que la loi exige). Elle ne contourne pas les protections des sites : pas d'évasion anti-robot, pas de résolution de CAPTCHA, pas de scraping d'un site qui l'interdit. Une liste « ne plus contacter » est tenue dans l'application.
