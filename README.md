# AutoVeille

Veille d'annonces automobiles pour un concessionnaire : l'application repère les nouvelles annonces de particuliers qui correspondent à ses critères (zone, kilométrage, marques, supercar / collection), rédige pour chacune un message personnalisé dans sa voix, et le prévient sur son téléphone. Il ouvre l'annonce, colle le message, envoie. Rien n'est envoyé sans lui.

## Comment ça marche

```
sites d'annonces ──(alertes email)──► boîte Gmail dédiée ──► AutoVeille ──► notification + message prêt
sites qui autorisent la lecture ──(page de résultats, robots.txt respecté)──┘
```

1. **Sources**. La source principale est la boîte mail : chaque site envoie lui-même ses nouvelles annonces quand on y crée une alerte (une seule alerte large par site, le tri fin se fait dans l'application). Une connexion IMAP gardée ouverte en IDLE (`src/infrastructure/email/imap/imapMailboxWatcher.ts`) lance le use case `pollMailbox` (`src/application/sources/`) dès que la boîte signale un nouvel email, et le planificateur (`src/infrastructure/scheduling/`) le relance en filet toutes les dix minutes (toutes les deux minutes avec `IMAP_IDLE=0` : section « Exploitation ») ; `pollMailbox` lit la boîte par l'adaptateur IMAP (`src/infrastructure/email/imap/`) ; l'extraction (`src/infrastructure/extraction/`, avec cheerio) reconstitue chaque annonce à partir de l'email (lien, titre, prix, km, année, ville, type de vendeur, photo). Ce qui distingue les sites (adresses des annonces, expéditeurs des alertes, liens de suivi, confirmations d'alerte, recherches pré-remplies) est décrit dans `src/domain/sites/`. Toutes les trente minutes, `fetchHttpSites` lit en plus une page de résultats pour les sites qui l'autorisent (`src/infrastructure/http/`, robots.txt vérifié par `src/domain/sites/robots.ts`, un seul essai, aucun contournement : si le site refuse, l'application le dit et renvoie vers l'alerte email).
2. **Lecture du texte** (`src/domain/parsing/`, `src/domain/catalog/`). Marque, modèle, année, km, prix et localisation sont extraits du titre et du texte. Les marques sont groupées en familles : allemandes, italiennes, américaines (Ford uniquement pour ses modèles américains), françaises.
3. **Filtres** (`src/domain/filtering/`). Zone (distance calculée par `src/domain/geo/distance.ts` à partir des coordonnées de l'API geo.api.gouv.fr, `src/infrastructure/http/geoApiGouvGeocoder.ts`, avec une table hors ligne en repli), kilométrage maximum, particuliers, familles et marques activées, règle « supercar et collection » par famille : prix plancher **ou** année maximale **ou** mot-clé dans le titre. Une annonce écartée garde ses raisons, typées (`RejectionReason`), regroupées pour l'onglet « Écartées par les filtres ».
4. **Dédoublonnage** (`src/domain/vehicle/identity.ts`, `src/domain/ingest/decide.ts`, use case `ingestListing` dans `src/application/ingest/`). Une même voiture est reconnue sur plusieurs sites et à travers les republications (même marque, modèle, année, département, km proches). Un changement de prix ou une republication met à jour la fiche sans renvoyer de message ; une baisse de prix sur une voiture encore en jeu (à traiter ou contactée) notifie « Prix baissé » (`src/domain/ingest/notifications.ts`).
5. **Messages** (`src/domain/messaging/`). Un gabarit par famille avec plusieurs variantes, variables `{modele}`, `{annee}`, `{km}`… remplies automatiquement ; une phrase dont une variable manque est retirée plutôt que laissée à trous. Un vérificateur signale les tirets longs, émojis et formules toutes faites.
6. **Notifications** (`src/application/notifications/`). Push web gratuit (`src/infrastructure/push/`), et Telegram en plus quand il est configuré (`src/infrastructure/http/telegramChannel.ts`).
7. **Interface** (`client/`). Application web installable (PWA, Vite et Preact), servie avec l'API par le serveur Fastify (`src/infrastructure/web/`). Quatre écrans : Annonces, Réglages, Messages, Sites.

Base SQLite (`better-sqlite3`, `src/infrastructure/persistence/sqlite/`, schéma migré par versions), serveur Fastify, TypeScript. Aucun service payant.

## Architecture

Hexagonale, par module métier : les règles sont des fonctions pures qui ne connaissent ni la base, ni le réseau, ni Fastify ; chaque technologie est un adaptateur branché derrière un port. Les règles complètes sont dans `CLAUDE.md`, les choix qui ne vont pas de soi dans `docs/decisions.md`.

```
src/
  domain/          règles pures : catalog, parsing, vehicle, filtering, messaging, settings, sites, ingest, geo, time, presentation (textes affichés)
  application/     use cases + ports/ (interfaces vers l'extérieur) : ingest, vehicles, settings, sources, notifications, auth, overview
  infrastructure/  adaptateurs : config, persistence/sqlite (et ses migrations), extraction (cheerio), email/imap, http, push, scheduling, system, web (Fastify)
  shared/          types de l'API (DTO) partagés serveur ↔ client, rien d'autre
  cli/             demo, parse-email (câblés par la composition)
  main.ts          composition : configuration → adaptateurs → use cases → serveur + planificateur
client/            Vite + TypeScript + Preact + signaux : src/screens/<écran>, src/components, src/state, src/api (client typé par shared/), src/sw.ts (service worker)
tests/             domain/, application/, contracts/, infrastructure/, migration/ (base héritée migrée), journeys/ (traversants), characterization/ (réponses de l'API figées en instantanés), cli/, client/, e2e/ (Playwright),
                   architecture.test.ts (règle de dépendance, moteur dans support/architecture/), support/ (mondes simulés : boîte mail, Internet, service de push), fakes/ (ports en mémoire), fixtures/ (emails, pages, base héritée)
deploy/            installation, mise à jour, sauvegarde quotidienne (scripts et unités systemd)
docs/decisions.md  journal des décisions
```

### Règle de dépendance

- `domain/` n'importe que `domain/` : ni `node:fs`, ni réseau, ni base, ni librairie tierce (seul `createHash` de `node:crypto` est toléré, pour l'empreinte d'une voiture). L'heure et l'aléatoire y entrent en paramètre, par les ports `Clock` et `Random`.
- `application/` importe `domain/` et `application/` (ses ports et les autres use cases), jamais `infrastructure/`.
- `infrastructure/` importe le domaine, l'application, `shared/`, les paquets npm et les modules de Node ; un adaptateur implémente un port et ne connaît pas les autres adaptateurs (aucune zone n'importe une autre zone).
- `shared/` ne contient que des types.
- `client/` importe ses propres modules, les types de `src/shared/` et ses paquets npm, jamais le reste de `src/`.
- Seuls `src/main.ts` et `src/cli/` instancient des adaptateurs, à la main, sans conteneur d'injection. Aucun état au niveau d'un module (ni singleton, ni cache, ni signal global côté client).
- Aucun commentaire dans `src/` et `client/` (feuille de style et page comprises) : une règle non évidente est un test nommé, une fonction ou une constante nommée, ou une entrée du journal.

Elle est vérifiée par `tests/architecture.test.ts`, qui fait partie de `npm test` (donc de `npm run verify` et de la CI) : il lit chaque fichier de `src/`, `client/`, `public/` et `tests/`, en analyse les imports sur l'arbre syntaxique, et échoue en nommant le fichier, la ligne et l'import fautif. Il refuse aussi les commentaires, les assertions de type hors de l'infrastructure et des tests (`as unknown as` et `as never` partout), l'état de module, l'heure courante, l'aléatoire et `fetch` dans le domaine et l'application, et un fichier rangé hors de la carte. Il n'existe aucune liste d'exceptions : un fichier qui enfreint une règle se corrige.

### Ajouter un site

1. **Catalogue** : dans `src/domain/sites/catalog.ts`, ajouter la clé à `SiteKey` et une entrée à `SITES` : `label`, `hosts` (domaines du site), `alertSenderDomains` (domaines qui envoient ses alertes), `listingPathPatterns` (motifs du chemin d'une annonce, le groupe 1 étant l'identifiant de l'annonce sur le site), `photoHosts` (hôtes des photos des annonces : quand la liste n'est pas vide, seule une image servie par l'un d'eux est prise pour la photo, ce qui écarte logos et illustrations ; vide, l'extraction devine en écartant pixels et icônes), et `manageAlertUrl` si le site a une page de gestion des alertes.
2. **Ce que le compilateur réclame ensuite**, les tables étant indexées par `SiteKey` : l'aide à la création de l'alerte (`SITE_ALERT_HELP`, `src/domain/presentation/siteHelp.ts`) et la recherche proposée par l'écran Sites (`searchLinks`, `src/domain/sites/alertSetup.ts`) : pré-remplie avec les réglages seulement si le format de l'adresse de recherche du site a été vérifié sur le site, sinon `blankSearch` vers sa page d'accueil. Si le site confirme la création d'une alerte par un email qui en donne les critères, sa lecture va dans `detectAlertConfirmation` (`src/domain/sites/confirmations.ts`). Un site sans clé dans `MAIN_SITES` (`client/src/sites/mainSites.ts`) est rangé parmi les sites facultatifs de l'écran Sites ; y ajouter sa clé le fait passer parmi les sites principaux, comptés par la carte Mise en route (« Les alertes sur les sites »).
3. **Un vrai email** : le télécharger depuis Gmail en `.eml`, l'anonymiser et le ranger dans `tests/fixtures/emails/<site>/` en suivant `tests/fixtures/emails/README.md`, puis vérifier la lecture avec `npm run parse-email -- fichier.eml`. L'extraction est générique (blocs autour d'un prix ou d'un kilométrage, `src/infrastructure/extraction/htmlAlertListings.ts`) : en principe, rien à écrire pour un nouveau site ; si sa mise en page la met en défaut, la correction va dans l'extraction, avec le test de cet email.
4. **Les tests nommés** : la reconnaissance des adresses d'annonce dans `tests/domain/sites/listingUrl.test.ts`, la lecture de l'email dans `tests/infrastructure/extraction/alertEmail.test.ts` (ou `alertConfirmation.test.ts` pour une confirmation), chacun nommé par la situation (« un email AutoScout24 où le prix est collé au kilométrage »).

### Ajouter une règle

1. **La règle** est une fonction pure du domaine, dans le module qu'elle concerne (`src/domain/filtering/`, `ingest/`, `messaging/`…), avec son test nommé par une situation réelle sous `tests/domain/` : écrit d'abord, rouge, puis vert.
2. **Le texte** qu'elle montre à l'utilisateur (raison d'écart, titre de notification, avertissement) va dans `src/domain/presentation/`, jamais dans la règle. Une nouvelle raison d'écart est un membre de l'union `RejectionReason` (`src/domain/filtering/verdict.ts`) ; le compilateur réclame alors sa phrase (`src/domain/presentation/reasons.ts`) et son groupe dans l'onglet « Écartées » (`REJECTION_GROUP_OF_KIND`, `src/domain/filtering/rejectionGroups.ts`, que la requête SQL des écartées et la relecture des raisons enregistrées reprennent telle quelle : rien à changer dans la base).
3. **Un use case** (`src/application/`) seulement si la règle déclenche un effet (lire, enregistrer, notifier) : il enchaîne les ports, et son test métier tourne sur les faux ports de `tests/fakes/`. Un changement de schéma est une nouvelle migration numérotée dans `src/infrastructure/persistence/sqlite/migrations/`, jamais une modification d'une migration livrée.

## Développement

```bash
npm install
cp .env.example .env
DEMO=1 npm run dev          # serveur (relancé à chaque modification) + client Vite : ouvrir http://localhost:5173, qui relaie /api vers le serveur
npm run demo                # ajoute les annonces d'exemple à la base locale (data/), sans redémarrer
npm run verify              # typage (serveur, client, service worker), Biome, tests : à lancer avant chaque commit
npm test                    # tests seuls : serveur et domaine sous Node, écrans sous jsdom
npx playwright install chromium   # une fois par machine : le navigateur des parcours e2e (environ 570 Mo sur le disque)
npm run test:e2e            # 4 parcours du GUIDE dans Chromium (Playwright), client reconstruit à chaque lancement
npm run build               # compile le serveur dans dist/server et le client dans dist/client
npm start                   # comme en production : dist/server sert dist/client sur http://localhost:3000
npm run parse-email -- alerte.eml   # tester l'extraction sur un email enregistré (fichier .eml)
```

Les parcours e2e (`tests/e2e/`) tournent contre `tests/e2e/server.ts`, lancé par Playwright : l'application composée comme en production, avec une base SQLite en mémoire par parcours, les annonces de démonstration, une boîte mail et un Internet simulés (aucune requête ne sort de la machine ; comme sur le serveur et dans les tests traversants, la boîte y est surveillée en IMAP IDLE, `IMAP_IDLE=0` n'étant posé que par les tests qui comptent les connexions ou l'état de la base à un instant précis ; la boîte simulée des parcours ne signale pas les emails reçus, ce que font les tests de `tests/journeys/mailboxWatch.test.ts`), sur les ports 4311 à 4314. Chaque parcours vérifie aussi qu'aucune ressource n'est demandée à Google Fonts et que la console ne signale aucune violation de la politique de sécurité (CSP).

Première connexion : si `SETUP_CODE` est vide dans `.env`, la page de première connexion n'est accessible que depuis la machine elle-même (localhost), y compris à travers le client Vite. Sur un serveur, `deploy/install.sh` génère ce code.

Le client est dans `client/` (Vite, Preact, signaux) et ne dépend que des types de `src/shared/api.ts`. La police Figtree est servie par l'application : en dehors des photos des annonces, que le navigateur charge depuis le site d'origine, aucune ressource n'est demandée à un autre site. Le thème choisi sur l'appareil est appliqué avant l'affichage par `/theme.js`, un script classique que `vite.config.ts` compile depuis `client/src/beforeFirstPaint.ts` (en développement comme au build). Le service worker (`client/src/sw.ts` : la page relue sur le serveur, la coque mise en cache en secours hors ligne, et les notifications) n'existe qu'au build : pour essayer les notifications, passer par `npm run build && npm start`.

## Calibrer l'extraction sur les vrais emails

Les gabarits d'emails des sites changent. L'écran **Sites** montre pour chaque email reçu ce qui a été extrait (ou « aucune annonce reconnue »). Pour ajuster :

- Enregistrer l'email en `.eml` depuis Gmail (menu « Télécharger le message »), l'anonymiser, et lancer `npm run parse-email -- fichier.eml` (`--offline` après le chemin pour ne suivre aucun lien). La marche à suivre complète est dans `tests/fixtures/emails/README.md`.
- Les motifs d'adresse des annonces par site sont dans `src/domain/sites/catalog.ts` (`listingPathPatterns`), la lecture des blocs d'un email dans `src/infrastructure/extraction/` (`htmlAlertListings.ts` pour le HTML, `textAlertListings.ts` pour le texte seul). Les tests de `tests/infrastructure/extraction/alertEmail.test.ts` donnent le format attendu ; ajouter l'email problématique comme nouveau cas, nommé par la situation.
- Les liens de suivi (`click.…`) sont déroulés sans réseau quand la destination est dans l'adresse (`src/domain/sites/tracking.ts`), sinon résolus par une requête HTTP qui suit les redirections (`src/infrastructure/http/fetchRedirectResolver.ts`), rien d'autre.

## Déploiement (serveur gratuit ou à 4 €/mois)

Tout tient dans `deploy/` :

- `install.sh` installe Node 22, Caddy (HTTPS automatique sur `<ip>.sslip.io`, gratuit), ouvre les ports 80/443, crée le service systemd, active la sauvegarde quotidienne de la base et génère le code de première connexion dans `/root/autoveille-setup.txt`.
- `cloud-init.yaml` fait la même chose automatiquement à la création d'une machine (Oracle Cloud Always Free, Hetzner, OVH…) : remplacer `REPO_URL` et `SETUP_CODE`, coller dans le champ cloud-init / user data.
- `update.sh` sauvegarde la base, met à jour depuis git et redémarre (ordre des commandes : section « Exploitation »).
- `backup.sh`, `autoveille-backup.service` et `autoveille-backup.timer` : la sauvegarde quotidienne.

Sur Oracle Cloud, en plus du script : autoriser les ports 80 et 443 dans la *security list* du réseau virtuel (VCN), et passer le compte en *Pay As You Go* pour éviter la récupération des machines inactives (sans frais tant qu'on reste sur les ressources Always Free).

Après l'installation : ouvrir `https://<ip>.sslip.io`, saisir le code, choisir le mot de passe. Puis dans **Sites** : relier la boîte Gmail (mot de passe d'application) et créer les alertes sur les sites ; dans **Réglages** : coordonnées, zone, marques ; sur le téléphone : installer l'application (« Ajouter à l'écran d'accueil ») et activer les notifications.

## Exploitation

Les commandes de cette section se lancent sur le serveur, en root (`sudo -i`). L'application vit dans `/opt/autoveille`, sa base dans `/opt/autoveille/data/autoveille.sqlite` ; le service s'appelle `autoveille` et tourne sous l'utilisateur `autoveille`.

### Sauvegardes

Deux séries de copies de la base, dans `/opt/autoveille/data/backups/` :

| Fichier | Fait par | Quand | Gardées |
|---|---|---|---|
| `quotidienne-AAAAMMJJ-HHMM.sqlite` | `deploy/backup.sh`, lancé par `autoveille-backup.timer` | chaque nuit à 3 h 30 (heure du serveur) ; une nuit manquée, serveur éteint, est rattrapée au redémarrage | les 14 dernières |
| `autoveille-AAAAMMJJ-HHMM.sqlite` | `deploy/update.sh` | avant chaque mise à jour | les 10 dernières |

Chaque script n'efface que ses propres copies. La copie est faite par l'API de sauvegarde de SQLite, cohérente même pendant que le service écrit ; la copie quotidienne est relue (`PRAGMA quick_check`) avant d'être gardée. La base et ses copies contiennent le mot de passe d'application de la boîte Gmail, les sessions et les clés : `install.sh` et `update.sh` réservent le dossier `data/` à l'utilisateur `autoveille` (droits `700`, root garde l'accès), et chaque copie n'est lisible que par lui. Une sauvegarde qui échoue (base absente, disque plein, copie illisible) laisse les anciennes en place et met le service en échec.

```bash
systemctl list-timers autoveille-backup      # prochaine et dernière sauvegarde quotidienne
journalctl -u autoveille-backup -n 20        # compte rendu (« Sauvegarde quotidienne : … ») ou raison de l'échec
systemctl start autoveille-backup            # une sauvegarde tout de suite, par exemple avant une manipulation
ls -l /opt/autoveille/data/backups/
```

Ces copies restent sur le disque du serveur : elles protègent d'une erreur ou d'une mise à jour ratée, pas de la perte de la machine. Pour en garder une ailleurs, depuis son ordinateur, avec un compte qui a `sudo` sans mot de passe sur le serveur : `ssh ubuntu@<serveur> "sudo cat /opt/autoveille/data/backups/quotidienne-AAAAMMJJ-HHMM.sqlite" > autoveille.sqlite`, à ranger en lieu sûr.

**Restaurer une copie**, pas à pas :

1. Choisir la copie : `ls -l /opt/autoveille/data/backups/`. Pour revenir sur une erreur, la dernière copie quotidienne d'avant l'erreur ; pour annuler une mise à jour, la copie `autoveille-…` prise par cette mise à jour (voir « Retour arrière »). Tout ce qui a été fait après la copie (statuts, notes, réglages, annonces reçues) est perdu. La copie garde la position de lecture de la boîte mail : les emails reçus depuis, encore dans la boîte, sont relus d'eux-mêmes par les passes suivantes (60 par passe : au démarrage, à chaque nouvel email signalé par la boîte et au moins toutes les dix minutes ; toutes les deux minutes avec `IMAP_IDLE=0`), et les annonces retenues absentes de la copie sont notifiées de nouveau. Ne pas lancer « Tout relire » dans **Sites** pour les récupérer : il repart des trois derniers jours seulement, et lancé avant que ces passes aient rattrapé la copie, il fait sauter pour de bon les emails plus anciens.
2. Arrêter le service, mettre la base actuelle de côté avec ses fichiers `-wal` et `-shm` (ils contiennent les dernières écritures et ne doivent jamais être mélangés avec une autre base), puis poser la copie :

   ```bash
   cd /opt/autoveille
   systemctl stop autoveille
   MIS_DE_COTE=data/avant-restauration-$(date +%Y%m%d-%H%M)
   mkdir "$MIS_DE_COTE" && mv data/autoveille.sqlite* "$MIS_DE_COTE"/
   install -o autoveille -g autoveille -m 600 data/backups/quotidienne-AAAAMMJJ-HHMM.sqlite data/autoveille.sqlite
   systemctl start autoveille
   ```

3. Vérifier (section « Santé ») et ouvrir l'application. Une copie faite par une version plus ancienne est migrée au démarrage ; une copie faite par une version plus récente que le code installé est refusée (le journal le dit) : réinstaller d'abord cette version.

### Santé

```bash
curl -s http://127.0.0.1:3000/api/health     # {"ok":true} : le serveur répond (aussi https://<domaine>/api/health, sans connexion)
systemctl status autoveille                  # actif, depuis quand, dernières lignes du journal
journalctl -u autoveille -n 50               # journal : « lecture planifiée en échec : … », refus de démarrer, erreurs
journalctl -u autoveille -f                  # suivre le journal en direct
```

`/api/health` dit seulement que le serveur répond : l'état de la boîte mail et des sites lus directement se voit dans l'écran **Sites** (« Fonctionne », « Problème », journal des emails reçus). Un service qui redémarre en boucle a laissé sa raison dans `journalctl -u autoveille` (configuration illisible, base plus récente que le code…).

### Boîte mail en IMAP IDLE

Par défaut (`IMAP_IDLE=1`), l'application garde une connexion ouverte sur le dossier des alertes en mode IDLE : la boîte (Gmail) signale chaque nouvel email, et l'application le lit aussitôt. Une annonce arrive ainsi sur le téléphone dans les secondes qui suivent l'email d'alerte, au lieu de jusqu'à deux minutes. Plusieurs emails signalés pendant une lecture sont lus par une seule lecture, juste après celle en cours. La boîte est aussi lue à chaque connexion, pour les emails arrivés pendant que la connexion manquait, et relue en filet toutes les dix minutes : un `IMAP_POLL_MINUTES` plus court (les 2 minutes du `.env.example`) est porté à 10 tant qu'IDLE est actif, une valeur plus longue est gardée. Une lecture traite 60 emails au plus : un arriéré plus long (copie restaurée, « Tout relire », longue coupure du serveur) se vide par 60 à chaque lecture, c'est-à-dire à chaque nouvel email signalé et au moins toutes les dix minutes, au lieu de toutes les deux minutes avec `IMAP_IDLE=0`.

Si la connexion tombe ou ne s'établit pas (Gmail injoignable, mot de passe d'application refusé, dossier introuvable), l'application réessaie au bout de 5 s, puis 10 s, 20 s, 40 s… et au plus toutes les 5 minutes ; l'attente ne revient à 5 s qu'après une connexion restée ouverte une minute : une connexion qui retombe aussitôt (fermée par Gmail juste après l'ouverture du dossier, coupée par un équipement du réseau au début de l'IDLE) laisse les essais s'espacer jusqu'à 5 minutes, au lieu de recommencer toutes les 5 s. Changer la boîte dans **Sites** (adresse, mot de passe d'application, serveur, port ou dossier) refait la connexion aussitôt ; sans boîte configurée, aucune connexion n'est ouverte. Le journal garde une ligne par connexion et par coupure, avec la réponse du serveur quand il en donne une (`[AUTHENTICATIONFAILED] Invalid credentials (Failure)` pour un mot de passe refusé, `[NONEXISTENT] Unknown Mailbox: …` pour un dossier introuvable), sans jamais le mot de passe ; une lecture lancée par IDLE qui échoue (base illisible, disque plein) est notée « lecture déclenchée par IMAP IDLE en échec : … » :

```bash
journalctl -u autoveille | grep 'IMAP IDLE'   # « IMAP IDLE : à l’écoute de « INBOX » », « IMAP IDLE interrompu (Socket timeout), nouvel essai dans 5 s »
```

Pour revenir à la seule relecture périodique (toutes les `IMAP_POLL_MINUTES`, deux minutes par défaut), ajouter `IMAP_IDLE=0` dans `/opt/autoveille/.env`, puis `systemctl restart autoveille`. Toute autre valeur que `0` ou `1` arrête le démarrage avec un message clair (`journalctl -u autoveille`).

### Mise à jour

Chaque mise à jour, en trois commandes :

```bash
sudo -u autoveille git -C /opt/autoveille rev-parse --short HEAD   # noter la version en place (retour arrière)
sudo -u autoveille git -C /opt/autoveille pull                     # récupère la nouvelle version, update.sh compris
bash /opt/autoveille/deploy/update.sh                              # sauvegarde la base, compile, redémarre
```

Récupérer le code avant de lancer `update.sh` garantit que c'est le `update.sh` de la nouvelle version qui s'exécute : lancé seul, l'ancien script se remplace lui-même pendant son `git pull` et se déroule jusqu'au bout dans son ancienne version. `git` est lancé sous l'utilisateur `autoveille`, propriétaire du dépôt : lancé en root, il refuse un dépôt qui ne lui appartient pas tant que `update.sh` ne l'a pas autorisé une première fois.

**Première mise à jour vers la version issue de la refonte** (serveur installé avant elle) : les mêmes trois commandes suffisent. Le nouveau `update.sh` sauvegarde la base (`autoveille-AAAAMMJJ-HHMM.sqlite`, l'ancienne application tourne encore), compile, remet le service sur le nouveau point d'entrée (« Service : ExecStart corrigé vers dist/server/main.js »), installe la sauvegarde quotidienne (« Sauvegarde quotidienne : minuteur installé… »), réserve `data/` à l'utilisateur `autoveille`, corrige la consigne de mise à jour de `/root/autoveille-setup.txt`, qui disait de lancer `update.sh` seul (« Consigne de mise à jour corrigée… »), et redémarre ; la nouvelle application migre alors la base en place, une seule fois (les raisons d'écart deviennent des lignes typées, les appareils connectés le restent). Si l'ancien `update.sh` a déjà été lancé seul (il annonce « AutoVeille mis à jour et redémarré. », mais l'interface répond 404 et `ExecStart` vise encore `dist/server.js`), lancer une fois le nouveau suffit : `bash /opt/autoveille/deploy/update.sh`. Puis vérifier :

```bash
grep ExecStart /etc/systemd/system/autoveille.service   # … dist/server/main.js
curl -s http://127.0.0.1:3000/api/health                # {"ok":true}
journalctl -u autoveille -n 50                          # aucune erreur au démarrage
systemctl list-timers autoveille-backup                 # prochaine sauvegarde quotidienne
```

Facultatif, une fois la nouvelle version en service : effacer les restes de l'ancien build, à la racine de `dist/` (`find /opt/autoveille/dist -mindepth 1 -maxdepth 1 ! -name server ! -name client -exec rm -rf {} +`) ; un retour arrière les reconstruit.

### Retour arrière

Revenir à la version précédente, c'est remettre son code **et** la base d'avant la mise à jour : une mise à jour peut migrer la base, et une version plus ancienne ne lit pas une base migrée. Tout ce qui a été fait depuis la mise à jour est perdu. Le service ne doit pas redémarrer entre les deux : la version en place migrerait de nouveau la copie.

Vers une version issue de la refonte ou plus récente :

```bash
cd /opt/autoveille
systemctl stop autoveille
MIS_DE_COTE=data/avant-retour-$(date +%Y%m%d-%H%M)
mkdir "$MIS_DE_COTE" && mv data/autoveille.sqlite* "$MIS_DE_COTE"/
install -o autoveille -g autoveille -m 600 data/backups/autoveille-AAAAMMJJ-HHMM.sqlite data/autoveille.sqlite   # la copie prise par cette mise à jour
sudo -u autoveille git checkout <version>   # notée avant la mise à jour ; à défaut, sudo -u autoveille git reflog -n 5 : l'entrée juste sous celle du « pull »
npm ci --ignore-scripts --no-audit --no-fund && npm run build && npm prune --omit=dev --no-audit --no-fund
chown -R autoveille:autoveille /opt/autoveille
systemctl start autoveille
```

Vers l'application d'avant la refonte : la migration a remplacé la colonne `reasons` de la table `vehicles` par la table `vehicle_rejections`, l'ancienne application ne peut donc tourner que sur la copie `autoveille-…` prise juste avant la première mise à jour. Il faut en plus, avant de redémarrer : effacer le build de la nouvelle version (l'ancien build ne le remplace pas, et son point d'entrée relancé migrerait la copie), remettre l'ancien point d'entrée, et retirer la sauvegarde quotidienne, que l'ancien code ne connaît pas (une mise à jour ultérieure la réinstalle). La séquence complète, dans cet ordre :

```bash
cd /opt/autoveille
systemctl stop autoveille
MIS_DE_COTE=data/avant-retour-$(date +%Y%m%d-%H%M)
mkdir "$MIS_DE_COTE" && mv data/autoveille.sqlite* "$MIS_DE_COTE"/
install -o autoveille -g autoveille -m 600 data/backups/autoveille-AAAAMMJJ-HHMM.sqlite data/autoveille.sqlite   # la copie prise juste avant la première mise à jour
sudo -u autoveille git checkout <version>   # notée avant la première mise à jour (même repli par git reflog)
rm -rf dist/server dist/client               # le build de la nouvelle version
npm ci --ignore-scripts --no-audit --no-fund && npm run build && npm prune --omit=dev --no-audit --no-fund
chown -R autoveille:autoveille /opt/autoveille
sed -i 's#dist/server/main\.js#dist/server.js#' /etc/systemd/system/autoveille.service
systemctl disable --now autoveille-backup.timer
rm /etc/systemd/system/autoveille-backup.service /etc/systemd/system/autoveille-backup.timer
systemctl daemon-reload
systemctl start autoveille
```

Après un retour arrière, le dépôt reste sur une version détachée, et la branche `main` locale pointe déjà sur la version qu'on vient de quitter. La mise à jour suivante note donc la version qui tourne avant de revenir sur `main`, puis enchaîne aussitôt (après le `checkout`, l'application d'avant la refonte, qui lit ses pages dans `public/`, ne les trouve plus jusqu'au redémarrage) :

```bash
sudo -u autoveille git -C /opt/autoveille rev-parse --short HEAD   # noter la version en place (retour arrière)
sudo -u autoveille git -C /opt/autoveille checkout main
sudo -u autoveille git -C /opt/autoveille pull
bash /opt/autoveille/deploy/update.sh
```

## Cadre

Les annonces appartiennent à des particuliers. L'application prépare le travail mais c'est une personne qui envoie chaque message, via le formulaire du site, avec ses coordonnées et une phrase indiquant qu'elle n'insistera pas (c'est l'indication d'opposition que la loi exige). Elle ne contourne pas les protections des sites : pas d'évasion anti-robot, pas de résolution de CAPTCHA, pas de scraping d'un site qui l'interdit. Une liste « ne plus contacter » est tenue dans l'application.
