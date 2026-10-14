#!/usr/bin/env bash
# Installation en une ligne, à lancer en root sur un serveur Ubuntu neuf :
#   curl -fsSL https://raw.githubusercontent.com/Baptiste-Fournel/autoveille/main/deploy/bootstrap.sh | sudo SETUP_CODE=XXXX bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -q >/dev/null && apt-get install -y -q git curl >/dev/null
mkdir -p /opt
if [ -d /opt/autoveille/.git ]; then git -C /opt/autoveille pull -q; else git clone -q https://github.com/Baptiste-Fournel/autoveille.git /opt/autoveille; fi
cd /opt/autoveille
REPO_URL="https://github.com/Baptiste-Fournel/autoveille.git" SETUP_CODE="${SETUP_CODE:-}" DOMAIN="${DOMAIN:-}" SSH_KEY="${SSH_KEY:-}" bash deploy/install.sh 2>&1 | tee /var/log/autoveille-install.log
