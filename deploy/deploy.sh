#!/usr/bin/env bash
# Script de atualização manual — roda como o usuário `oestefreios`, dentro de /opt/oeste-freios.
# Uso: ./deploy/deploy.sh
set -euo pipefail

APP_DIR="/opt/oeste-freios"
BRANCH="master"

cd "$APP_DIR"

echo "==> git pull (${BRANCH})"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> instalando dependências"
npm ci

echo "==> build (backend + frontend)"
npm run build

echo "==> rodando migrations"
# precisa rodar de dentro de backend/ — o dotenv carrega o .env relativo ao cwd atual.
(cd backend && node dist/database/postgres/migrate.js)

# Boletos são privados e ficam fora de /api/uploads. O caminho precisa existir antes do systemd subir.
install -d -m 700 "$APP_DIR/backend/storage/cobrancas"

echo "==> reiniciando backend"
sudo systemctl restart oeste-freios-backend

echo "==> status do serviço"
sudo systemctl status oeste-freios-backend --no-pager -l | head -15

echo "==> testando nginx"
sudo nginx -t

echo "Deploy concluído."
