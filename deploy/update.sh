#!/usr/bin/env bash
# Met à jour AutoVeille depuis le dépôt git et redémarre le service.
# Procédure (README.md, section « Exploitation › Mise à jour »), en root :
#   sudo -u autoveille git -C /opt/autoveille rev-parse --short HEAD   noter la version en place, pour un retour arrière
#   sudo -u autoveille git -C /opt/autoveille pull                     récupère d'abord ce script dans sa nouvelle version
#   bash /opt/autoveille/deploy/update.sh
# Lancé seul, ce script se remplace lui-même pendant son git pull et se déroule jusqu'au bout dans son ancienne version.
#
# Les données (annonces, statuts, réglages, mots de passe des sites) vivent dans data/, que git ignore. Une mise à jour
# peut migrer la base au redémarrage, et une version plus ancienne ne lit pas une base migrée : une copie datée de la base
# est donc faite avant chaque mise à jour, data/backups/autoveille-AAAAMMJJ-HHMM.sqlite (les dix dernières sont gardées ;
# les copies quotidiennes de deploy/backup.sh, quotidienne-*.sqlite, ne sont pas touchées). Revenir à la version
# précédente, c'est remettre son code et cette copie sans redémarrer entre les deux : README.md, « Exploitation › Retour
# arrière ». Restaurer seulement la copie, sous le code en place, la ferait migrer de nouveau au démarrage.
set -euo pipefail
cd /opt/autoveille
# Le dépôt appartient à l'utilisateur autoveille ; git refuse sinon de le lire en root.
git config --global --add safe.directory /opt/autoveille >/dev/null 2>&1 || true

DATA=/opt/autoveille/data
DB=$DATA/autoveille.sqlite
if [ -f "$DB" ]; then
  # La base et ses copies contiennent le mot de passe de la boîte mail, les sessions et les clés : data/ est réservé à
  # l'utilisateur autoveille (un serveur installé avant cette règle a reçu data/ en 755, et la base en 644).
  chmod 700 "$DATA"
  mkdir -p "$DATA/backups"
  chown autoveille:autoveille "$DATA/backups"
  chmod 700 "$DATA/backups"
  STAMP=$(date +%Y%m%d-%H%M)
  COPY="$DATA/backups/autoveille-$STAMP.sqlite"
  # Copie cohérente même pendant que le service tourne (API de sauvegarde SQLite, pas un simple cp).
  sudo -u autoveille node -e "
    const Database = require('better-sqlite3');
    const db = new Database(process.argv[1], { readonly: true });
    db.backup(process.argv[2]).then(() => { db.close(); }).catch((e) => { console.error(e); process.exit(1); });
  " "$DB" "$COPY"
  chmod 600 "$COPY"
  ls -1t /opt/autoveille/data/backups/autoveille-*.sqlite 2>/dev/null | tail -n +11 | xargs -r rm -f
  echo "Sauvegarde : data/backups/autoveille-$STAMP.sqlite"
fi

git pull -q
npm ci --ignore-scripts --no-audit --no-fund >/dev/null
npm run build >/dev/null
npm prune --omit=dev --no-audit --no-fund >/dev/null
chown -R autoveille:autoveille /opt/autoveille
# Un serveur installé avant la refonte lance encore dist/server.js ; le point d'entrée est désormais dist/server/main.js.
UNIT=/etc/systemd/system/autoveille.service
if [ -f "$UNIT" ] && grep -q '^ExecStart=.* dist/server\.js$' "$UNIT"; then
  sed -i 's#^\(ExecStart=.*\) dist/server\.js$#\1 dist/server/main.js#' "$UNIT"
  echo "Service : ExecStart corrigé vers dist/server/main.js"
fi
# Sauvegarde quotidienne (deploy/backup.sh) : un serveur installé avant elle n'exécute que ce script. Les unités
# sont recopiées à chaque mise à jour ; le minuteur n'est activé que s'il manquait (un arrêt voulu est respecté).
BACKUP_TIMER_MISSING=0
[ -f /etc/systemd/system/autoveille-backup.timer ] || BACKUP_TIMER_MISSING=1
install -m 644 deploy/autoveille-backup.service deploy/autoveille-backup.timer /etc/systemd/system/
systemctl daemon-reload
if [ "$BACKUP_TIMER_MISSING" = 1 ]; then
  systemctl enable --now autoveille-backup.timer >/dev/null
  echo "Sauvegarde quotidienne : minuteur installé (data/backups/quotidienne-*.sqlite, 14 gardées)"
fi
# Un serveur installé avant la refonte garde dans /root/autoveille-setup.txt la consigne de lancer ce script seul.
SETUP_NOTE=/root/autoveille-setup.txt
OLD_UPDATE_LINE='Mettre à jour : sudo bash /opt/autoveille/deploy/update.sh'
if [ -f "$SETUP_NOTE" ] && grep -qxF "$OLD_UPDATE_LINE" "$SETUP_NOTE"; then
  sed -i "s#^$OLD_UPDATE_LINE\$#Mettre à jour : sudo -u autoveille git -C /opt/autoveille pull, puis sudo bash /opt/autoveille/deploy/update.sh (README.md, section « Exploitation » : version à noter avant, retour arrière)#" "$SETUP_NOTE"
  echo "Consigne de mise à jour corrigée dans $SETUP_NOTE"
fi
systemctl restart autoveille
echo "AutoVeille mis à jour et redémarré."
