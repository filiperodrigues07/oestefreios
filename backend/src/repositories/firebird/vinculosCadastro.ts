import { firebirdQuery } from '../../database/firebird/pool.js';
import type { VinculosCadastro } from '../../types/cherp.types.js';

/**
 * Onde o CHERP guarda registros que apontam para um cliente/veículo. Levantado no banco real:
 * quase nenhuma dessas tabelas tem FK, então nada impede o CHERP de "ficar com ponteiro pra nada"
 * se o cadastro sumir — a checagem tem que ser nossa. Qualquer linha conta como vínculo (conservador),
 * exceto OS e veículos, onde só os ATIVOS contam (OS excluída não segura o cadastro).
 */
export interface OrigemVinculo {
  grupo: keyof VinculosCadastro;
  tabela: string;
  coluna: string;
  somenteAtivos?: boolean;
}

export const ORIGENS_CLIENTE: OrigemVinculo[] = [
  { grupo: 'os', tabela: 'ORDEMSERVICO', coluna: 'CHAVECLIFOR', somenteAtivos: true },
  { grupo: 'veiculos', tabela: 'EQUIPAMENTOS', coluna: 'CHAVECLIFOR', somenteAtivos: true },
  { grupo: 'financeiro', tabela: 'RECEBER', coluna: 'CHAVECLIFOR' },
  { grupo: 'financeiro', tabela: 'PAGAR', coluna: 'CHAVECLIFOR' },
  { grupo: 'financeiro', tabela: 'CAIXA', coluna: 'CHAVECLIFOR' },
  { grupo: 'financeiro', tabela: 'LANCBCO', coluna: 'CHAVECLIFOR' },
  { grupo: 'financeiro', tabela: 'CREDITO', coluna: 'CHAVECLIFOR' },
  { grupo: 'fiscal', tabela: 'NFSAIDA', coluna: 'CHAVECLIFOR' },
  { grupo: 'fiscal', tabela: 'NFENTRADA', coluna: 'CHAVECLIFOR' },
  { grupo: 'pedidos', tabela: 'PEDIDOSAIDA', coluna: 'CHAVECLIFOR' },
  { grupo: 'pedidos', tabela: 'COTACAO', coluna: 'CHAVECLIFOR' },
  { grupo: 'outros', tabela: 'OSAGENDA', coluna: 'CHAVECLIFOR' },
  { grupo: 'outros', tabela: 'ESTOQUE', coluna: 'CHAVECLIFOR' },
  { grupo: 'outros', tabela: 'PRODUTOFORNEC', coluna: 'CHAVECLIFOR' },
  { grupo: 'outros', tabela: 'INVENTARIOITENS', coluna: 'CHAVECLIFOR' },
  { grupo: 'outros', tabela: 'ITENSCOMPLDOCFISCAL', coluna: 'CHAVECLIFOR' },
];

export const ORIGENS_VEICULO: OrigemVinculo[] = [
  { grupo: 'os', tabela: 'ORDEMSERVICO', coluna: 'CHAVEEQUIPAMENTO', somenteAtivos: true },
];

export function vinculosVazios(): VinculosCadastro {
  return { os: 0, veiculos: 0, financeiro: 0, fiscal: 0, pedidos: 0, outros: 0 };
}

/**
 * Fragmento `NOT EXISTS (...) AND ...` para embutir no próprio UPDATE de exclusão — checar e gravar
 * na mesma instrução evita a janela em que alguém abre uma OS entre o "pode excluir?" e o "excluiu".
 * Nomes de tabela/coluna vêm só das constantes acima (nada do usuário entra no SQL).
 */
export function condicaoSemVinculos(origens: OrigemVinculo[], aliasPai: string): string {
  return origens
    .map(
      (o, i) =>
        `NOT EXISTS (SELECT 1 FROM ${o.tabela} V${i} WHERE V${i}.${o.coluna} = ${aliasPai}.CHAVE${o.somenteAtivos ? ` AND V${i}.ATIVO = 1` : ''})`,
    )
    .join('\n         AND ');
}

export async function contarVinculosTabelas(origens: OrigemVinculo[], chave: number): Promise<VinculosCadastro> {
  const totais = vinculosVazios();
  await Promise.all(
    origens.map(async (o) => {
      const rows = await firebirdQuery<{ TOTAL: number }>(
        `SELECT COUNT(*) AS TOTAL FROM ${o.tabela} WHERE ${o.coluna} = ?${o.somenteAtivos ? ' AND ATIVO = 1' : ''}`,
        [chave],
      );
      totais[o.grupo] += Number(rows[0]?.TOTAL ?? 0);
    }),
  );
  return totais;
}
