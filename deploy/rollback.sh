#!/usr/bin/env bash
# Volta manualmente pra release anterior (ou pra uma específica). Rode como oestefreios.
# Uso: ./deploy/rollback.sh              -> release imediatamente anterior à atual
#      ./deploy/rollback.sh 20260925-1430 -> essa release
# Atenção: não desfaz migration do banco (ver comentário em deploy.sh).
set -euo pipefail

APP_BASE="${APP_BASE:-/opt/oeste-freios-app}"
SYSTEMCTL="${SYSTEMCTL:-sudo systemctl}"
RELEASES="$APP_BASE/releases"
ATUAL="$(basename "$(readlink -f "$APP_BASE/current")")"

if [ $# -ge 1 ]; then
  ALVO="$1"
else
  # Releases têm nome data-hora: a anterior é a maior que vem antes da atual.
  ALVO="$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | awk -v atual="$ATUAL" '$0 < atual' | tail -n 1)"
fi

[ -n "$ALVO" ] && [ -d "$RELEASES/$ALVO" ] || { echo "Release de destino não encontrada. Disponíveis:" >&2; ls "$RELEASES" >&2; exit 1; }
[ "$ALVO" != "$ATUAL" ] || { echo "$ALVO já é a release no ar." >&2; exit 1; }

echo "==> $ATUAL -> $ALVO"
ln -sfn "$RELEASES/$ALVO" "$APP_BASE/current.novo"
mv -Tf "$APP_BASE/current.novo" "$APP_BASE/current"
$SYSTEMCTL restart oeste-freios-backend
echo "Rollback concluído. Confira: curl -s http://127.0.0.1:3000/api/health"
