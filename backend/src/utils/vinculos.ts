import type { VinculosCadastro } from '../types/cherp.types.js';

export function temVinculos(vinculos: VinculosCadastro): boolean {
  return Object.values(vinculos).some((total) => total > 0);
}

/** Frase para o usuário: só cita o que realmente existe. */
export function descreverVinculos(vinculos: VinculosCadastro, tipo: 'cliente' | 'veículo'): string {
  const partes: string[] = [];
  if (vinculos.os > 0) partes.push(`${vinculos.os} OS`);
  if (vinculos.veiculos > 0) partes.push(`${vinculos.veiculos} veículo(s)`);
  if (vinculos.financeiro > 0) partes.push('lançamentos financeiros');
  if (vinculos.fiscal > 0) partes.push('notas fiscais');
  if (vinculos.pedidos > 0) partes.push('pedidos/cotações');
  if (vinculos.outros > 0) partes.push('outros registros do CHERP');
  return `Este ${tipo} tem ${partes.join(', ')} vinculado(s) e não pode ser excluído. Inative em vez de excluir.`;
}
