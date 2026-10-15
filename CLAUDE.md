# AutoVeille — règles du projet

Veille d'annonces automobiles pour un concessionnaire (utilisateur unique, sur téléphone). L'application lit une boîte Gmail dédiée où les sites d'annonces envoient leurs alertes, reconnaît chaque voiture, applique des filtres, rédige un message et notifie. Rien n'est envoyé à sa place. Lire `README.md` (fonctionnement) et `GUIDE.md` (parcours utilisateur : c'est la référence des comportements attendus) avant toute modification.

Cadre légal à ne jamais franchir : pas de contournement anti-robot, pas de CAPTCHA, pas de lecture d'un site qui l'interdit (`robots.txt`), jamais d'envoi automatique de message.

## Commandes

```bash
npm run dev          # serveur (tsx watch) + client (vite) avec proxy /api
npm run build        # tsc (serveur → dist/server) + vite build (client → dist/client)
npm start            # node dist/server/main.js
npm run verify       # check + lint + test — DOIT être vert avant tout commit
npm run check        # tsc --noEmit (serveur + client)
npm run lint         # biome check
npm test             # vitest : unitaires, métier, contrat, intégration, traversants, architecture
npm run test:e2e     # playwright, 4 parcours du GUIDE (chromium)
npm run parse-email -- fichier.eml   # extraction sur un email enregistré
npm run demo         # annonces d'exemple dans la base locale
```

## Architecture : hexagonale, par module métier

```
src/
  domain/          règles pures : catalog, parsing, vehicle, filtering, messaging, settings, sites, ingest, presentation
  application/     use cases + ports/ (interfaces vers l'extérieur) ; ingest, vehicles, settings, sources, notifications, auth, overview
  infrastructure/  adaptateurs : config, persistence/sqlite, extraction (cheerio), email/imap, http, push, scheduling, web (Fastify)
  shared/          types de l'API (DTO) partagés serveur ↔ client, rien d'autre
  cli/             demo, parse-email (câblés via la composition)
  main.ts          composition root : config → adaptateurs → use cases → serveur + scheduler
client/            Vite + TypeScript + Preact + signals ; src/screens/<écran>, src/components, src/api (client typé par shared/)
tests/             fakes/ (ports en mémoire), contracts/, fixtures/ (emails .eml, pages HTML, bases legacy), e2e/
docs/decisions.md  journal des décisions (une entrée datée par choix non évident)
```

### Règle de dépendance (vérifiée par `tests/architecture.test.ts`, bloquante)

- `domain/` n'importe que `domain/`. Ni `node:fs`, ni réseau, ni base, ni librairie tierce. `node:crypto` est toléré uniquement pour hacher (empreinte).
- `application/` importe `domain/` et `application/ports/`. Jamais `infrastructure/`.
- `infrastructure/` importe tout. Un adaptateur implémente un port ; il ne connaît pas les autres adaptateurs.
- `shared/` ne contient que des types et n'importe rien.
- `client/` importe `shared/` et ses propres modules. Jamais `src/`.
- Seuls `main.ts` et `cli/` instancient des adaptateurs. Pas de conteneur d'injection : câblage à la main.
- Aucun état global : pas de singleton de configuration, de settings ou de cache au niveau module. Tout est passé par paramètre ou construit dans `main.ts`.

### Où va quoi

- Une règle métier (quand une voiture est « la même », quand un prix baissé notifie, quelle phrase d'un message tombe) → `domain/`, fonction pure, testée sans base ni réseau.
- Un enchaînement d'effets (lire la boîte, ingérer, marquer l'email) → un use case dans `application/`, qui ne parle qu'à des ports.
- Une technologie (SQLite, IMAP, fetch, web-push, cheerio, Fastify) → `infrastructure/`, derrière un port.
- Une chaîne destinée à l'utilisateur (raison de rejet, titre de notification, message d'erreur) → `domain/presentation/` ou `infrastructure/web/`, jamais éparpillée. Les raisons de rejet sont une union typée (`RejectionReason`), jamais des chaînes qu'on re-parse.
- Le modèle de ligne SQL ne sort jamais de `infrastructure/persistence/`. Un seul mapper ligne ↔ domaine par agrégat.
- Les transitions de statut (et les événements à effacer quand on revient en arrière) sont dans `domain/vehicle/status.ts`, pas dans une route.

### Décisions figées

- Mono-utilisateur. Aucun `accountId`. L'absence d'état global suffit pour qu'un éventuel multi-compte reste un changement localisé aux ports.
- Persistance : SQLite via `better-sqlite3`, confiné dans `infrastructure/persistence/sqlite`. Migrations versionnées par `PRAGMA user_version` ; `001_initial.sql` est le schéma hérité, les suivantes sont additives. La base de production est migrée en place, jamais recréée.
- Les valeurs persistées et exposées par l'API restent telles quelles (`nouveau`, `contacte`, `repondu`, `ignore`, `prix_baisse`, `republiee`, `statut_contacte`…). Les identifiants de code sont en anglais ; seuls les textes destinés à l'utilisateur sont en français.
- Fonctionnalités conservées : sources HTTP (robots.txt, JSON-LD), Telegram, import ponctuel (`/api/import`, `/api/import/dates` en `text/plain` + jeton).

## Conventions de code

- **Aucun commentaire** dans `src/` et `client/`, JSDoc compris. Une règle non évidente devient un test nommé, une fonction ou une constante nommée, ou une entrée dans `docs/decisions.md`. Dans les tests, seuls `// Arrange` `// Act` `// Assert` ou `// Given` `// When` `// Then` sont permis.
- TypeScript `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`. Interdits : `any`, `!` (non-null assertion), `as unknown as`, `as never`. Les `as` restent dans les mappers de `infrastructure/`.
- Fonctions plutôt que classes quand il n'y a pas d'état. Données immuables (`readonly`, spread), pas de mutation d'un objet reçu en paramètre.
- Un fichier = un concept, nommé par ce qu'il contient. Pas de fichier `utils.ts`. Pas de barrel `index.ts` qui masque les dépendances.
- Erreurs : classes d'erreur de domaine/application (`VehicleNotFound`, `InvalidSettings`…), mappées en codes HTTP dans `infrastructure/web/errors.ts`. Aucun `catch {}` silencieux sauf là où ignorer est le comportement voulu, et alors un test le dit.
- Validation d'entrée HTTP par JSON Schema Fastify (une par route, dans `infrastructure/web/schemas/`). Les use cases reçoivent des données déjà typées.
- DRY : une seule fonction pour chaque transformation (ligne → `RawListing`, `Vehicle` → DTO…). KISS : la solution la plus simple qui passe les tests. YAGNI : rien pour un besoin qui n'existe pas (pas de paramètre « au cas où », pas de générique sans deuxième usage).
- Dépendances : en ajouter une se justifie dans `docs/decisions.md` (taille, maintenance, ce qu'elle remplace).
- Textes des gabarits de messages, du `GUIDE.md` et des écrans : contenu métier, à reproduire à l'identique sauf demande explicite.

## Tests

**Un test = une situation réelle, nommée.** Le nom décrit la situation en langage courant (« un email AutoScout24 où le prix est collé au kilométrage », pas « handles edge case »). Le Given la reproduit avec des données réelles : vrais titres d'annonces, `.eml` anonymisés dans `tests/fixtures/emails/<site>/`, vraies réponses de sites. Si on ne sait pas dire dans quelle circonstance le cas se produit, le test n'a pas sa place. Pas de tests combinatoires pour la couverture, pas de test d'un chemin que le code ne peut pas emprunter.

| Niveau | Cible | Dépendances |
|---|---|---|
| Unitaire | `domain/` | aucune |
| Métier | use cases de `application/` | fakes de `tests/fakes/` |
| Contrat | chaque port : le fake **et** l'adaptateur réel jouent la même suite (`tests/contracts/`) | SQLite `:memory:` |
| Intégration | `infrastructure/` | fixtures `.eml`/HTML, `fetch` simulé |
| Migration | base construite avec le schéma hérité (`tests/fixtures/db/`) puis migrée | fichier SQLite temporaire |
| Traversant | `main.ts` câblé avec SQLite mémoire, boîte mail et réseau simulés, appels `app.inject` | tout sauf le réseau |
| Fonctionnel client | composants Preact (`@testing-library/preact`) ; parcours du GUIDE en Playwright | serveur de test |
| Architecture | règle de dépendance | fichiers de `src/` et `client/` |

- On ne mocke que les ports. Jamais une fonction de domaine, jamais une fonction qu'on possède.
- Chaque parcours du `GUIDE.md` (mise en route, notification → contact, prix baissé, garder quand même, relecture de la boîte, rafale) a un test traversant ; c'est le guide qui définit les parcours.
- Pas de seuil de couverture chiffré. `domain/` et `application/` étant purs, un chemin non couvert est un cas réel oublié ou du code mort à supprimer.
- Dates et aléatoire passent par les ports `Clock` et `Random` : un test ne dépend jamais de l'heure réelle.
- Un test existant ne se supprime pas ; il se migre et se renomme si son nom ne dit pas la situation.

## Git

- Travailler sur la branche indiquée par la mission. Un commit par étape cohérente, `npm run verify` vert à chaque commit. Jamais de `--force`, jamais de push sans demande.
- Message de commit en français, une phrase qui décrit le comportement ou la structure obtenue (style des commits existants), pas le détail des fichiers.
- Ne jamais modifier `data/`, `.env`, ni les scripts de `deploy/` sans que la mission le demande explicitement.

## Ce qu'il ne faut pas faire

- Pas de nouveau site, pas de nouvelle fonctionnalité pendant un refacto : le périmètre est celui de la mission.
- Pas de réécriture d'un texte utilisateur « pour faire mieux ».
- Pas de question à l'utilisateur quand une décision peut être prise et consignée dans `docs/decisions.md`. Poser une question uniquement si l'on est bloqué par un manque d'information que le code ne contient pas.
