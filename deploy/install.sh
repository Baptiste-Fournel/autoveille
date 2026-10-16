#!/usr/bin/env bash
# Installation d'AutoVeille sur un serveur Ubuntu (22.04 ou 24.04), x86_64 ou ARM64.
# Utilisé par deploy/cloud-init.yaml, ou à lancer à la main en root :  sudo bash deploy/install.sh
#
# Variables (facultatives) :
#   REPO_URL      dépôt git à installer (défaut : le dossier courant doit déjà contenir le code)
#   SETUP_CODE    code de première connexion (défaut : généré, affiché à la fin et dans /root/autoveille-setup.txt)
#   DOMAIN        nom de domaine pour le HTTPS (défaut : <ip-publique>.sslip.io, gratuit)
#   ACME_EMAIL    email pour le certificat Let's Encrypt (facultatif)
#   SSH_KEY       clé publique SSH à autoriser pour l'administration (facultatif)
set -euo pipefail

APP_USER=autoveille
APP_DIR=/opt/autoveille
export DEBIAN_FRONTEND=noninteractive

log() { echo "==> $*"; }

[ "$(id -u)" = 0 ] || { echo "Lancez ce script en root (sudo)."; exit 1; }

if [ ! -f /swapfile ] && [ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 3000 ]; then
  log "Fichier d'échange de 1 Go (petite machine)"
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Paquets système"
apt-get update -q
echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections
apt-get install -y -q curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https iptables-persistent build-essential python3 >/dev/null

if ! command -v node >/dev/null || [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 22 ]; then
  log "Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -q nodejs >/dev/null
fi

if ! command -v caddy >/dev/null; then
  log "Caddy (HTTPS automatique)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -q && apt-get install -y -q caddy >/dev/null
fi

log "Pare-feu : ouverture des ports 22, 80 et 443"
for p in 22 80 443; do
  iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$p" -j ACCEPT
done
netfilter-persistent save >/dev/null 2>&1 || true
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

log "Code de l'application"
if [ -n "${REPO_URL:-}" ]; then
  if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull -q; else rm -rf "$APP_DIR"; git clone -q "$REPO_URL" "$APP_DIR"; fi
elif [ ! -f "$APP_DIR/package.json" ]; then
  SRC="$(cd "$(dirname "$0")/.." && pwd)"
  mkdir -p "$APP_DIR"; cp -r "$SRC"/. "$APP_DIR"/
fi
cd "$APP_DIR"
npm ci --ignore-scripts --no-audit --no-fund >/dev/null
npm run build >/dev/null
npm prune --omit=dev --no-audit --no-fund >/dev/null
mkdir -p "$APP_DIR/data"

SETUP_CODE="${SETUP_CODE:-$(openssl rand -hex 4 | tr 'a-f' 'A-F')}"
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<ENV
PORT=3000
HOST=127.0.0.1
DATA_DIR=$APP_DIR/data
SETUP_CODE=$SETUP_CODE
CONTACT_EMAIL=${ACME_EMAIL:-}
ENV
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/.env"
# La base et ses copies contiennent le mot de passe de la boîte mail, les sessions et les clés.
chmod 700 "$APP_DIR/data"

if [ -n "${SSH_KEY:-}" ]; then
  log "Clé SSH d'administration"
  for home in /root "$(getent passwd ubuntu | cut -d: -f6)"; do
    [ -n "$home" ] && [ -d "$home" ] || continue
    mkdir -p "$home/.ssh" && chmod 700 "$home/.ssh"
    grep -qF "$SSH_KEY" "$home/.ssh/authorized_keys" 2>/dev/null || echo "$SSH_KEY" >> "$home/.ssh/authorized_keys"
    chmod 600 "$home/.ssh/authorized_keys"; chown -R "$(stat -c %U "$home")" "$home/.ssh"
  done
fi

log "Service systemd"
cat > /etc/systemd/system/autoveille.service <<UNIT
[Unit]
Description=AutoVeille
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node dist/server/main.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now autoveille >/dev/null
systemctl restart autoveille

log "Sauvegarde quotidienne de la base (data/backups/, 14 gardées)"
install -m 644 "$APP_DIR/deploy/autoveille-backup.service" "$APP_DIR/deploy/autoveille-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now autoveille-backup.timer >/dev/null

PUBLIC_IP="$(curl -4 -s --max-time 10 https://api.ipify.org || curl -4 -s --max-time 10 https://ifconfig.me || true)"
DOMAIN="${DOMAIN:-${PUBLIC_IP//./-}.sslip.io}"
log "HTTPS pour https://$DOMAIN"
{
  if [ -n "${ACME_EMAIL:-}" ]; then printf '{\n  email %s\n}\n\n' "$ACME_EMAIL"; fi
  printf '%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:3000\n}\n' "$DOMAIN"
} > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

cat > /root/autoveille-setup.txt <<TXT
AutoVeille est installé.
Adresse : https://$DOMAIN
Code de première connexion : $SETUP_CODE
Mettre à jour : sudo -u $APP_USER git -C $APP_DIR pull, puis sudo bash $APP_DIR/deploy/update.sh (README.md, section « Exploitation » : version à noter avant, retour arrière)
TXT
echo
cat /root/autoveille-setup.txt
