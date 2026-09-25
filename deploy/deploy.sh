#!/usr/bin/env bash
# Atualização em produção — roda como o usuário `oestefreios`. Uso: ./deploy/deploy.sh
#
# Deploy atômico (layout de releases, ver DEPLOY.md "Deploy atômico"):
#   /opt/oeste-freios            clone do git (só fonte das releases; nada roda daqui)
#   /opt/oeste-freios-app/
#     releases/<data-hora>/      cada versão compilada, isolada (git worktree)
#     shared/                    .env, uploads/, storage/ — sobrevivem entre versões
#     current -> releases/...    o que o systemd e o nginx servem
#
# A versão nova é instalada e compilada ao lado da atual; só no fim o link `current` troca (atômico)
# e o backend reinicia. Se o /api/health não responder com a versão nova em 60s, volta sozinho pra
# anterior. Usuário nunca vê build pela metade.
#
# Sem o layout de releases (servidor ainda não migrado), cai no fluxo antigo — rode
# deploy/migrar-para-releases.sh uma vez pra ganhar rollback.
set -Eeuo pipefail  # -E: a trap de ERR vale dentro de main()

APP_DIR="${APP_DIR:-/opt/oeste-freios}"
APP_BASE="${APP_BASE:-/opt/oeste-freios-app}"
BRANCH="${BRANCH:-master}"
MANTER_RELEASES="${MANTER_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
# Sobrescrevíveis pra testar o script fora da VPS.
SYSTEMCTL="${SYSTEMCTL:-sudo systemctl}"
NGINX="${NGINX:-sudo nginx}"
NPM="${NPM:-npm}"
NODE="${NODE:-node}"

servico_reiniciar() { $SYSTEMCTL restart oeste-freios-backend; }

# Todo o fluxo fica dentro de main(): o bash lê a função inteira antes de executar, então atualizar
# este próprio arquivo (git pull / ff do clone) no meio do deploy não embaralha a execução.
main() {

deploy_legado() {
  echo "==> AVISO: layout de releases não encontrado em $APP_BASE — usando deploy antigo (sem rollback)."
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
  $NPM ci
  $NPM run build
  (cd backend && $NODE dist/database/postgres/migrate.js)
  install -d -m 700 "$APP_DIR/backend/storage/cobrancas"
  servico_reiniciar
  $NGINX -t
  echo "Deploy concluído (legado)."
}

if [ ! -L "$APP_BASE/current" ]; then
  deploy_legado
  return 0
fi

RELEASES="$APP_BASE/releases"
SHARED="$APP_BASE/shared"
NOVA="$RELEASES/$(date +%Y%m%d-%H%M%S)"
ANTERIOR="$(readlink -f "$APP_BASE/current")"

# Falha antes de trocar o link: remove a release pela metade e sai; produção nem foi tocada.
limpar_release_nova() {
  echo "==> Falhou antes de publicar — produção continua em $(basename "$ANTERIOR")." >&2
  git -C "$APP_DIR" worktree remove --force "$NOVA" 2>/dev/null || rm -rf "$NOVA"
}
trap limpar_release_nova ERR

echo "==> buscando $BRANCH"
git -C "$APP_DIR" fetch origin "$BRANCH"
# O clone não roda nada, mas é de onde o systemd chama backup.sh/restore-test.sh e onde está este
# script: avança junto pra não ficarem numa versão velha.
git -C "$APP_DIR" merge --ff-only "origin/$BRANCH" >/dev/null
git -C "$APP_DIR" worktree add --detach "$NOVA" "origin/$BRANCH"
VERSAO="$(git -C "$NOVA" rev-parse --short HEAD)"
echo "==> nova release $(basename "$NOVA") ($VERSAO)"

# Estado compartilhado: a release só enxerga links pra shared/.
ln -sfn "$SHARED/.env" "$NOVA/backend/.env"
rm -rf "$NOVA/backend/uploads" "$NOVA/backend/storage"
ln -sfn "$SHARED/uploads" "$NOVA/backend/uploads"
ln -sfn "$SHARED/storage" "$NOVA/backend/storage"

echo "==> instalando dependências e compilando"
(cd "$NOVA" && $NPM ci && $NPM run build)

echo "==> migrations"
# Migrations rodam antes da troca: precisam ser compatíveis com a versão anterior (só adicionar,
# nunca renomear/remover coluna no mesmo deploy), porque o rollback não desfaz migration.
(cd "$NOVA/backend" && $NODE dist/database/postgres/migrate.js)

trap - ERR

echo "==> publicando"
ln -sfn "$NOVA" "$APP_BASE/current.novo"
mv -Tf "$APP_BASE/current.novo" "$APP_BASE/current"
servico_reiniciar

versao_no_ar() { curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4; }

echo "==> conferindo saúde (até ${HEALTH_TIMEOUT}s)"
ok=false
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  if [ "$(versao_no_ar || true)" = "$VERSAO" ]; then ok=true; break; fi
  sleep 1
done

if [ "$ok" != true ]; then
  echo "==> ERRO: versão $VERSAO não respondeu saudável. Voltando para $(basename "$ANTERIOR")." >&2
  ln -sfn "$ANTERIOR" "$APP_BASE/current.novo"
  mv -Tf "$APP_BASE/current.novo" "$APP_BASE/current"
  servico_reiniciar
  echo "Rollback feito. Veja o log: journalctl -u oeste-freios-backend -n 200" >&2
  return 1
fi

$NGINX -t && $SYSTEMCTL reload nginx

echo "==> limpando releases antigas (mantém $MANTER_RELEASES)"
ATUAL="$(readlink -f "$APP_BASE/current")"
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +"$((MANTER_RELEASES + 1))" | while read -r antiga; do
  [ "$(readlink -f "$antiga")" = "$ATUAL" ] && continue
  git -C "$APP_DIR" worktree remove --force "$antiga" 2>/dev/null || rm -rf "$antiga"
done
git -C "$APP_DIR" worktree prune

echo "Deploy concluído: $VERSAO no ar ($(basename "$NOVA"))."
}

main "$@"
