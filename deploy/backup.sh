#!/usr/bin/env bash
# Backup diário do Postgres + arquivos (uploads e boletos). Rode como o usuário do serviço (oestefreios).
# Agendamento: deploy/systemd/oeste-freios-backup.timer (ver comentários lá).
# Restauração: gunzip -c postgres-AAAAMMDD.sql.gz | psql "$DATABASE_URL"  e  tar -xzf arquivos-AAAAMMDD.tar.gz -C /
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/oeste-freios}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/oeste-freios}"
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"
DATA="$(date +%Y%m%d)"

# DATABASE_URL vem do .env do backend (mesmo arquivo que o serviço usa).
set -a
# shellcheck disable=SC1091
. "$APP_DIR/backend/.env"
set +a
: "${DATABASE_URL:?DATABASE_URL não definido no .env}"

umask 077
install -d -m 700 "$BACKUP_DIR"

pg_dump --no-owner --clean --if-exists "$DATABASE_URL" | gzip -9 > "$BACKUP_DIR/postgres-$DATA.sql.gz.tmp"
mv "$BACKUP_DIR/postgres-$DATA.sql.gz.tmp" "$BACKUP_DIR/postgres-$DATA.sql.gz"

tar -czf "$BACKUP_DIR/arquivos-$DATA.tar.gz.tmp" -C / \
  "${APP_DIR#/}/backend/uploads" "${APP_DIR#/}/backend/storage/cobrancas"
mv "$BACKUP_DIR/arquivos-$DATA.tar.gz.tmp" "$BACKUP_DIR/arquivos-$DATA.tar.gz"

# Só apaga os antigos depois de o novo backup ter sido gravado com sucesso.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'postgres-*.sql.gz' -o -name 'arquivos-*.tar.gz' \) -mtime +"$RETENCAO_DIAS" -delete

echo "Backup $DATA ok em $BACKUP_DIR"
