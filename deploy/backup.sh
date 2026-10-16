#!/usr/bin/env bash
# Sauvegarde quotidienne de la base d'AutoVeille, lancée chaque nuit par autoveille-backup.timer
# (installé par install.sh, ou par update.sh sur un serveur installé avant son arrivée).
# Sauvegarde immédiate, à la main : sudo systemctl start autoveille-backup ; compte rendu : journalctl -u autoveille-backup -n 5
#
# Copie cohérente même pendant que le service écrit (API de sauvegarde SQLite, comme update.sh), relue
# (PRAGMA quick_check) avant d'être rangée sous data/backups/quotidienne-AAAAMMJJ-HHMM.sqlite ; les 14 dernières
# sont gardées. Les copies d'avant mise à jour (data/backups/autoveille-AAAAMMJJ-HHMM.sqlite, faites par update.sh,
# qui en garde 10) ne sont jamais effacées par ce script, et update.sh n'efface jamais les quotidiennes.
# Un échec (base absente, copie illisible, disque plein) sort en erreur, laisse les anciennes copies en place et
# marque le service en échec (systemctl status autoveille-backup). Restauration : README.md, section « Exploitation ».
#
# Variables (facultatives, pour essayer le script ailleurs que sur le serveur) :
#   AUTOVEILLE_DIR       dossier de l'application, d'où node charge better-sqlite3 (défaut : /opt/autoveille)
#   AUTOVEILLE_DATA_DIR  dossier de la base et de ses sauvegardes (défaut : $AUTOVEILLE_DIR/data)
set -euo pipefail

APP_DIR="${AUTOVEILLE_DIR:-/opt/autoveille}"
DATA_DIR="${AUTOVEILLE_DATA_DIR:-$APP_DIR/data}"
DB="$DATA_DIR/autoveille.sqlite"
BACKUP_DIR="$DATA_DIR/backups"
KEEP=14

if [ "$(id -u)" = 0 ]; then
  echo "À ne pas lancer en root : sudo systemctl start autoveille-backup (la copie appartient alors à l'utilisateur autoveille)." >&2
  exit 1
fi
if [ ! -f "$DB" ]; then
  echo "Base introuvable : $DB" >&2
  exit 1
fi

# La base contient les mots de passe de la boîte mail et des sessions : copies lisibles par leur seul propriétaire.
umask 077
mkdir -p "$BACKUP_DIR"
TARGET="$BACKUP_DIR/quotidienne-$(date +%Y%m%d-%H%M).sqlite"
PARTIAL="$TARGET.partiel"
trap 'rm -f "$PARTIAL" "$PARTIAL-wal" "$PARTIAL-shm"' EXIT

cd "$APP_DIR"
node -e "
  const Database = require('better-sqlite3');
  const [source, copy] = process.argv.slice(1);
  const db = new Database(source, { readonly: true, fileMustExist: true });
  db.backup(copy)
    .then(() => {
      db.close();
      const written = new Database(copy, { fileMustExist: true });
      written.pragma('journal_mode = DELETE');
      const check = written.pragma('quick_check', { simple: true });
      written.close();
      if (check !== 'ok') throw new Error('copie illisible : ' + check);
    })
    .catch((error) => { console.error('Sauvegarde en échec : ' + error.message); process.exit(1); });
" "$DB" "$PARTIAL"
mv "$PARTIAL" "$TARGET"

printf '%s\n' "$BACKUP_DIR"/quotidienne-*.sqlite | sort -r | tail -n +$((KEEP + 1)) | while IFS= read -r old; do rm -f -- "$old"; done
echo "Sauvegarde quotidienne : $TARGET (copies quotidiennes gardées : $(printf '%s\n' "$BACKUP_DIR"/quotidienne-*.sqlite | wc -l | tr -d ' '))"
