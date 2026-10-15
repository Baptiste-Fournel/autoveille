# Emails de test

Un dossier par site : `leboncoin/`, `lacentrale/`, `autoscout24/`, `paruvendu/`, et `petit-site-auto/` pour un site que l'application ne connaît pas (lecture générique).

Le nom du fichier dit la situation, en français, en minuscules, sans accents, mots séparés par des tirets : `une-nouvelle-annonce.html`, `baisses-de-prix-avec-une-illustration-a-la-place-des-photos.html`. L'extension dit ce que contient le fichier : `.eml` pour un email complet, `.html` ou `.txt` pour son seul corps.

## Ajouter un vrai email

1. **Télécharger** le message depuis Gmail : ouvrir l'email, menu ⋮, « Télécharger le message ». On obtient un fichier `.eml`.
2. **Anonymiser** le fichier avant toute autre chose. Remplacer par des valeurs neutres (`Prénom Nom`, `0`, `x`) sans toucher à la structure HTML :
   - noms et prénoms (destinataire, vendeur) ;
   - adresses email du destinataire et des particuliers, y compris dans les en-têtes (`To`, `Delivered-To`, `Received`, `Return-Path`, `List-Unsubscribe`) ;
   - numéros de téléphone ;
   - liens de désinscription personnels et leurs paramètres (`verif=`, `ticket=`, identifiants d'alerte ou de compte) ;
   - jetons de suivi : liens de clic, pixels d'ouverture, `mailUniqId` et paramètres du même genre.

   Les adresses génériques des sites (`info@…`) peuvent rester. Le corps d'un `.eml` est souvent encodé (quoted-printable, avec des `=3D` et des lignes coupées par `=`, ou base64) : chercher les données personnelles dans le texte décodé, pas seulement dans le fichier brut. Une fois commité, l'email reste dans l'historique git : rien de personnel ne doit y entrer.
3. **Ranger** le fichier dans `tests/fixtures/emails/<site>/`, sous un nom qui dit la situation.
4. **Vérifier l'extraction** :

   ```bash
   npm run parse-email -- tests/fixtures/emails/<site>/<situation>.eml
   npm run parse-email -- tests/fixtures/emails/<site>/<situation>.eml --offline
   ```

   Sans `--offline`, la commande suit chaque lien de suivi par une requête HTTP pour trouver l'annonce. Avec `--offline` (toujours après le chemin du fichier), elle ne fait aucune requête et compte les liens non résolus dans `pending`.
5. **Écrire le test** nommé par la situation (« un email AutoScout24 où le prix est collé au kilométrage »). Un `.eml` est un message MIME encodé, pas le corps que lit l'extraction : le test le charge avec `await loadEmail('emails/<site>/<situation>.eml')` (`tests/support/email.ts`, chemin relatif à `tests/fixtures/`), qui le décode avec `simpleParser` de `mailparser` exactement comme `npm run parse-email`, et rend `{ html, text, subject, from, date, messageId }`, prêt pour l'extraction. Un corps seul (`.html`, `.txt`) se charge tel quel avec `loadFixture('emails/<site>/<situation>.html')` (`tests/support/fixtures.ts`). Si l'email passe par des liens de suivi, le test fournit lui-même la table « lien → destination » : il n'utilise jamais le réseau.

## Fixtures actuelles

- `paruvendu/une-nouvelle-annonce.html` et `lacentrale/61-nouvelles-annonces-dont-3-en-apercu.html` sont de vrais emails d'alerte du 15/10/2026, anonymisés.
- Les confirmations d'alerte (`confirmation-…`) et `autoscout24/recherche-sauvegardee-deux-annonces-et-liens-app-store.html` reproduisent la mise en page des sites relevée le 14/10/2026, réduite à ce qui compte pour la lecture.
- Les autres sont des échantillons écrits à la main pour la situation qu'ils nomment. `petit-site-auto` est un site fictif.
