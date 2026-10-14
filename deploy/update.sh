#!/usr/bin/env bash
# Met à jour AutoVeille depuis le dépôt git et redémarre le service.
# À lancer en root : sudo bash /opt/autoveille/deploy/update.sh
#
# Les données (annonces, statuts, réglages, mots de passe des sites) vivent dans data/, que git ignore :
# une mise à jour ne les touche jamais. Par précaution, une copie datée de la base est faite avant
# chaque mise à jour dans data/backups/ (les dix dernières sont gardées). Pour revenir en arrière :
#   systemctl stop autoveille
#   cp data/backups/autoveille-AAAAMMJJ-HHMM.sqlite data/autoveille.sqlite && rm -f data/autoveille.sqlite-wal data/autoveille.sqlite-shm
#   systemctl start autoveille
set -euo pipefail
cd /opt/autoveille
# Le dépôt appartient à l'utilisateur autoveille ; git refuse sinon de le lire en root.
git config --global --add safe.directory /opt/autoveille >/dev/null 2>&1 || true

DB=/opt/autoveille/data/autoveille.sqlite
if [ -f "$DB" ]; then
  mkdir -p /opt/autoveille/data/backups
  chown autoveille:autoveille /opt/autoveille/data/backups
  STAMP=$(date +%Y%m%d-%H%M)
  # Copie cohérente même pendant que le service tourne (API de sauvegarde SQLite, pas un simple cp).
  sudo -u autoveille node -e "
    const Database = require('better-sqlite3');
    const db = new Database(process.argv[1], { readonly: true });
    db.backup(process.argv[2]).then(() => { db.close(); }).catch((e) => { console.error(e); process.exit(1); });
  " "$DB" "/opt/autoveille/data/backups/autoveille-$STAMP.sqlite"
  ls -1t /opt/autoveille/data/backups/autoveille-*.sqlite 2>/dev/null | tail -n +11 | xargs -r rm -f
  echo "Sauvegarde : data/backups/autoveille-$STAMP.sqlite"
fi

git pull -q
npm ci --ignore-scripts --no-audit --no-fund >/dev/null
npm run build >/dev/null
npm prune --omit=dev --no-audit --no-fund >/dev/null
chown -R autoveille:autoveille /opt/autoveille
systemctl restart autoveille
echo "AutoVeille mis à jour et redémarré."
