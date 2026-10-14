#!/usr/bin/env bash
# Met à jour AutoVeille depuis le dépôt git et redémarre le service.
set -euo pipefail
cd /opt/autoveille
git pull -q
npm ci --ignore-scripts --no-audit --no-fund >/dev/null
npm run build >/dev/null
npm prune --omit=dev --no-audit --no-fund >/dev/null
chown -R autoveille:autoveille /opt/autoveille
systemctl restart autoveille
echo "AutoVeille mis à jour et redémarré."
