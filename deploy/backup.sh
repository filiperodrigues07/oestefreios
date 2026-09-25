#!/usr/bin/env bash
# Backup diário do Postgres + arquivos (uploads e boletos). Rode como o usuário do serviço (oestefreios).
# Agendamento: deploy/systemd/oeste-freios-backup.timer (ver comentários lá).
# Restauração: gunzip -c postgres-AAAAMMDD.sql.gz | psql "$DATABASE_URL"  e  tar -xzf arquivos-AAAAMMDD.tar.gz -C /
# Teste automático de restauração: deploy/restore-test.sh (timer mensal).
#
# Opcionais (no .env do backend ou no ambiente):
#   RCLONE_REMOTE           destino externo do rclone, ex. "b2:oeste-freios-backup" — sem ele, só backup local.
#   RETENCAO_REMOTA_DIAS    quantos dias manter no destino externo (padrão 30).
#   HEALTHCHECK_BACKUP_URL  URL de ping (Healthchecks.io etc.): sucesso pinga a URL, falha pinga URL/fail.
#                           Se o ping parar de chegar, o serviço de monitoramento avisa você.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/oeste-freios}"
APP_BASE="${APP_BASE:-/opt/oeste-freios-app}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/oeste-freios}"
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"
DATA="$(date +%Y%m%d)"

# Layout com releases (deploy atômico) guarda .env/uploads/boletos em shared/; o layout antigo, dentro do clone.
if [ -f "$APP_BASE/shared/.env" ]; then
  ENV_FILE="$APP_BASE/shared/.env"
  ARQUIVOS=("$APP_BASE/shared/uploads" "$APP_BASE/shared/storage/cobrancas")
else
  ENV_FILE="$APP_DIR/backend/.env"
  ARQUIVOS=("$APP_DIR/backend/uploads" "$APP_DIR/backend/storage/cobrancas")
fi

# DATABASE_URL (e os opcionais acima) vêm do mesmo .env que o serviço usa.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${DATABASE_URL:?DATABASE_URL não definido no .env}"

ping_monitor() {
  [ -n "${HEALTHCHECK_BACKUP_URL:-}" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${HEALTHCHECK_BACKUP_URL}$1" || echo "Aviso: ping do monitor falhou" >&2
}
# Qualquer comando que falhar daqui pra frente avisa o monitor antes de sair.
trap 'ping_monitor /fail' ERR

umask 077
install -d -m 700 "$BACKUP_DIR"

pg_dump --no-owner --clean --if-exists "$DATABASE_URL" | gzip -9 > "$BACKUP_DIR/postgres-$DATA.sql.gz.tmp"
mv "$BACKUP_DIR/postgres-$DATA.sql.gz.tmp" "$BACKUP_DIR/postgres-$DATA.sql.gz"

# Caminhos relativos a / (tar -C /) pra restauração extrair no mesmo lugar.
ARQUIVOS_REL=()
for caminho in "${ARQUIVOS[@]}"; do
  if [ -e "$caminho" ]; then ARQUIVOS_REL+=("${caminho#/}"); fi
done
tar -czf "$BACKUP_DIR/arquivos-$DATA.tar.gz.tmp" -C / "${ARQUIVOS_REL[@]}"
mv "$BACKUP_DIR/arquivos-$DATA.tar.gz.tmp" "$BACKUP_DIR/arquivos-$DATA.tar.gz"

# Só apaga os antigos depois de o novo backup ter sido gravado com sucesso.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'postgres-*.sql.gz' -o -name 'arquivos-*.tar.gz' \) -mtime +"$RETENCAO_DIAS" -delete

# Cópia fora da VPS: backup no mesmo disco não protege contra perda da máquina.
REMOTO=null
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "postgres-$DATA.sql.gz" --include "arquivos-$DATA.tar.gz" \
    && rclone delete "$RCLONE_REMOTE" --min-age "${RETENCAO_REMOTA_DIAS:-30}d"; then
    REMOTO=true
  else
    REMOTO=false
  fi
fi

# Lido pela aba Configurações > Sistema (BACKUP_STATUS_FILE no .env do backend).
printf '{"finishedAt":"%s","local":true,"remote":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$REMOTO" \
  > "$BACKUP_DIR/last-backup.json.tmp"
mv "$BACKUP_DIR/last-backup.json.tmp" "$BACKUP_DIR/last-backup.json"
chmod 640 "$BACKUP_DIR/last-backup.json"

if [ "$REMOTO" = false ]; then
  echo "Backup local $DATA ok, mas a cópia externa ($RCLONE_REMOTE) falhou" >&2
  ping_monitor /fail
  exit 1
fi

ping_monitor ""
echo "Backup $DATA ok em $BACKUP_DIR${RCLONE_REMOTE:+ e $RCLONE_REMOTE}"
