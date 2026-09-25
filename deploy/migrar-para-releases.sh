#!/usr/bin/env bash
# Migração ÚNICA do layout antigo (tudo dentro de /opt/oeste-freios) pro layout de releases.
# Rode como oestefreios. Não para o serviço nem mexe no systemd/nginx: só prepara as pastas.
# Depois siga DEPLOY.md "Deploy atômico" (trocar unit do systemd e root do nginx, rodar deploy.sh).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/oeste-freios}"
APP_BASE="${APP_BASE:-/opt/oeste-freios-app}"
SHARED="$APP_BASE/shared"

if [ -L "$APP_BASE/current" ]; then
  echo "Já migrado ($APP_BASE/current existe)."
  exit 0
fi

install -d -m 750 "$APP_BASE" "$APP_BASE/releases"
install -d -m 700 "$SHARED" "$SHARED/storage" "$SHARED/storage/cobrancas"
install -d -m 755 "$SHARED/uploads"

# Copia (não move): o serviço atual continua rodando do layout antigo até a troca do systemd.
cp -p "$APP_DIR/backend/.env" "$SHARED/.env"
chmod 600 "$SHARED/.env"
[ -d "$APP_DIR/backend/uploads" ] && cp -a "$APP_DIR/backend/uploads/." "$SHARED/uploads/"
[ -d "$APP_DIR/backend/storage/cobrancas" ] && cp -a "$APP_DIR/backend/storage/cobrancas/." "$SHARED/storage/cobrancas/"

# Primeira release = o mesmo commit que já está no ar, compilado no layout novo.
PRIMEIRA="$APP_BASE/releases/$(date +%Y%m%d-%H%M%S)"
git -C "$APP_DIR" worktree add --detach "$PRIMEIRA" HEAD
ln -sfn "$SHARED/.env" "$PRIMEIRA/backend/.env"
rm -rf "$PRIMEIRA/backend/uploads" "$PRIMEIRA/backend/storage"
ln -sfn "$SHARED/uploads" "$PRIMEIRA/backend/uploads"
ln -sfn "$SHARED/storage" "$PRIMEIRA/backend/storage"
(cd "$PRIMEIRA" && npm ci && npm run build)
ln -sfn "$PRIMEIRA" "$APP_BASE/current"

cat <<EOF

Pastas prontas em $APP_BASE (release inicial: $(basename "$PRIMEIRA")).
Próximos passos (como root/sudo), em DEPLOY.md "Deploy atômico":
  1. Copiar deploy/systemd/oeste-freios-backend.service (layout novo) e daemon-reload.
  2. Trocar o root do nginx para $APP_BASE/current/frontend/dist e recarregar.
  3. systemctl restart oeste-freios-backend e conferir /api/health.
Atenção: uploads/boletos feitos entre esta cópia e o passo 3 ficam só no layout antigo —
faça os passos logo em seguida (ou rode este script de novo antes, depois de apagar $APP_BASE).
EOF
