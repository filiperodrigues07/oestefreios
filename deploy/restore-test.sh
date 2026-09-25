#!/usr/bin/env bash
# Teste de restauração: backup que nunca foi restaurado é só esperança. Restaura o dump mais recente
# num banco temporário, confere se as tabelas principais têm linhas e apaga o banco temporário.
# Agendamento: deploy/systemd/oeste-freios-restore-test.timer (mensal). Rode como oestefreios.
#
# Requer que o usuário do Postgres do app possa criar banco (ALTER USER oeste_freios CREATEDB;) —
# ou defina RESTORE_ADMIN_URL com uma conexão que possa (ex.: postgres://postgres@/postgres).
# Opcional: HEALTHCHECK_RESTORE_URL (mesmo esquema do backup.sh: sucesso pinga, falha pinga /fail).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/oeste-freios}"
APP_BASE="${APP_BASE:-/opt/oeste-freios-app}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/oeste-freios}"

if [ -f "$APP_BASE/shared/.env" ]; then ENV_FILE="$APP_BASE/shared/.env"; else ENV_FILE="$APP_DIR/backend/.env"; fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${DATABASE_URL:?DATABASE_URL não definido no .env}"

ping_monitor() {
  [ -n "${HEALTHCHECK_RESTORE_URL:-}" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${HEALTHCHECK_RESTORE_URL}$1" || true
}

BANCO_TESTE="oeste_freios_restore_test"
ADMIN_URL="${RESTORE_ADMIN_URL:-$DATABASE_URL}"
# Troca só o nome do banco no fim da URL (postgres://u:s@host:5432/NOME?params).
TESTE_URL="$(printf '%s' "$DATABASE_URL" | sed -E "s#/[^/?]+(\?|$)#/${BANCO_TESTE}\1#")"

limpar() { psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS ${BANCO_TESTE};" >/dev/null 2>&1 || true; }
falhar() {
  echo "Teste de restauração FALHOU: $1" >&2
  ping_monitor /fail
  limpar
  exit 1
}
trap 'falhar "comando falhou na linha $LINENO"' ERR

DUMP="$(find "$BACKUP_DIR" -maxdepth 1 -name 'postgres-*.sql.gz' -type f | sort | tail -n 1)"
[ -n "$DUMP" ] || falhar "nenhum dump em $BACKUP_DIR"

limpar
psql "$ADMIN_URL" -q -c "CREATE DATABASE ${BANCO_TESTE};"
gunzip -c "$DUMP" | psql "$TESTE_URL" -q -v ON_ERROR_STOP=1 >/dev/null

# Tabelas que nunca ficam vazias num sistema em uso.
for tabela in users roles permissions audit_logs; do
  linhas="$(psql "$TESTE_URL" -tA -c "SELECT count(*) FROM ${tabela};")"
  [ "$linhas" -gt 0 ] || falhar "tabela ${tabela} veio vazia do dump $(basename "$DUMP")"
done

ARQUIVOS="${DUMP/postgres-/arquivos-}"
ARQUIVOS="${ARQUIVOS%.sql.gz}.tar.gz"
if [ -f "$ARQUIVOS" ]; then
  tar -tzf "$ARQUIVOS" >/dev/null || falhar "tar de arquivos corrompido: $(basename "$ARQUIVOS")"
fi

trap - ERR
limpar
ping_monitor ""
echo "Teste de restauração ok: $(basename "$DUMP") restaurado e conferido."
