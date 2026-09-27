/**
 * Limpeza única do campo Observação (ORDEMSERVICO.OBS) das OS gravadas pelo formato antigo do app,
 * com os marcadores [OBSERVACOES]/[SOLUCAO] (inclusive cópias feitas pelo "Duplicar" do CHERP).
 * Reescreve como texto livre: observações + o antigo "serviço realizado" no fim, nada se perde.
 *
 * Por padrão só MOSTRA o que mudaria. Pra gravar: `npm run limpar-obs -w backend -- --aplicar`.
 * Só mexe em OS em aberto (SITUACAO = 0); faturadas ficam como estão, a menos de `--incluir-fechadas`.
 * Usa a conexão Firebird salva em Configurações (a mesma do app).
 */
import { closeFirebirdPool, firebirdQuery, firebirdTransaction } from '../database/firebird/pool.js';
import { toLatin1Param } from '../database/firebird/encoding.js';
import { decodeObsTexto, encodeObsTexto, temMarcadorAntigo } from '../repositories/firebird/obsField.js';
import { applyStoredFirebirdSettings } from '../services/settings.service.js';

const aplicar = process.argv.includes('--aplicar');
const incluirFechadas = process.argv.includes('--incluir-fechadas');

async function main() {
  await applyStoredFirebirdSettings();
  const rows = await firebirdQuery<{ CHAVE: number; ORDEM: string; SITUACAO: number; OBS: string | null }>(
    `SELECT CHAVE, ORDEM, SITUACAO, CAST(OBS AS VARCHAR(5000) CHARACTER SET OCTETS) AS OBS
     FROM ORDEMSERVICO
     WHERE ATIVO = 1 ${incluirFechadas ? '' : 'AND SITUACAO = 0'}
       AND (OBS CONTAINING '[OBSERVACOES]' OR OBS CONTAINING '[SOLUCAO]')
     ORDER BY CHAVE`,
  );
  const alvos = rows
    .filter((r) => temMarcadorAntigo(r.OBS))
    .map((r) => ({ ...r, novo: encodeObsTexto(decodeObsTexto(r.OBS).observacoes) }));

  console.log(`${alvos.length} OS com marcadores${incluirFechadas ? '' : ' (só em aberto)'}.`);
  for (const a of alvos) {
    console.log(`\nOS ${a.ORDEM}\n  antes: ${JSON.stringify(a.OBS)}\n  depois: ${JSON.stringify(a.novo)}`);
  }
  if (!aplicar) {
    console.log('\nNada foi gravado. Para aplicar: npm run limpar-obs -w backend -- --aplicar');
    return;
  }
  // Tudo numa transação: ou limpa todas, ou nenhuma.
  await firebirdTransaction(async (query) => {
    for (const a of alvos) {
      await query('UPDATE ORDEMSERVICO SET OBS = ? WHERE CHAVE = ?', [a.novo === null ? null : toLatin1Param(a.novo), a.CHAVE]);
    }
  });
  console.log(`\n${alvos.length} OS limpas.`);
}

main()
  .catch((err: unknown) => {
    console.error('Falhou:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeFirebirdPool());
