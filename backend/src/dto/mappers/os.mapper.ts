import type { Permission } from '../../types/auth.types.js';
import type { OrdemServico } from '../../types/cherp.types.js';
import type { AdminOSDTO, OperationalOSDTO } from '../os.dto.js';

/** Monta o DTO correto por perfil. Nunca deixe o financeiro vazar via spread solto de `os`. */
export function toOSDTO(
  os: OrdemServico,
  permissions: Permission[],
): OperationalOSDTO | AdminOSDTO {
  const base: OperationalOSDTO = {
    id: os.id,
    numero: os.numero,
    clienteCodigo: os.clienteCodigo,
    clienteNome: os.clienteNome,
    equipamentoCodigo: os.equipamentoCodigo,
    equipamentoDescricao: os.equipamentoDescricao,
    status: os.status,
    prioridade: os.prioridade,
    responsavelId: os.responsavelId,
    tecnicoId: os.tecnicoId,
    problema: os.problema,
    diagnostico: os.diagnostico,
    observacoes: os.observacoes,
    solucao: os.solucao,
    produtos: os.produtos.map((p) => ({
      produtoCodigo: p.produtoCodigo,
      descricao: p.descricao,
      unidade: p.unidade,
      quantidade: p.quantidade,
    })),
    servicos: os.servicos.map((s) => ({
      servicoCodigo: s.servicoCodigo,
      descricao: s.descricao,
      unidade: s.unidade,
      quantidade: s.quantidade,
    })),
    historico: os.historico,
    dataAbertura: os.dataAbertura,
    dataPrevista: os.dataPrevista,
    dataConclusao: os.dataConclusao,
    nroDav: os.nroDav,
    kmAtual: os.kmAtual,
    kmFinal: os.kmFinal,
  };

  if (!permissions.includes('FINANCIAL_VIEW')) {
    return base;
  }

  const admin: AdminOSDTO = {
    ...base,
    produtos: os.produtos.map((p) => ({
      produtoCodigo: p.produtoCodigo,
      descricao: p.descricao,
      unidade: p.unidade,
      quantidade: p.quantidade,
      precoUnitario: p.precoUnitario,
      desconto: p.desconto,
      total: p.total,
    })),
    servicos: os.servicos.map((s) => ({
      servicoCodigo: s.servicoCodigo,
      descricao: s.descricao,
      unidade: s.unidade,
      quantidade: s.quantidade,
      valorUnitario: s.valorUnitario,
      desconto: s.desconto,
      total: s.total,
    })),
    faturamento: os.faturamento,
    frete: os.frete,
    totalIpi: os.totalIpi,
  };
  return admin;
}
