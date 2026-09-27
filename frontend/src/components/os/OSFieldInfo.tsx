import type { ReactNode } from 'react';
import { hasPermission } from '../../store/authStore.js';
import { Tooltip } from '../ui/index.js';
import styles from './OSFieldInfo.module.css';

type FieldKey = 'cliente' | 'veiculo' | 'status' | 'prioridade' | 'responsavel' | 'tecnico' | 'previsao' | 'dav' | 'kmAtual' | 'kmFinal' | 'diagnostico' | 'observacoes' | 'totais';

const metadata: Record<FieldKey, { origem: string; tipo: string; descricao: string }> = {
  cliente: { origem: 'ORDEMSERVICO.CHAVECLIFOR + CLIFOR', tipo: 'FK / exibição derivada', descricao: 'Vínculo da OS ao cliente; nome vem de FANTASIA ou RAZAOSOCIAL.' },
  veiculo: { origem: 'ORDEMSERVICO.CHAVEEQUIPAMENTO + EQUIPAMENTOS', tipo: 'FK / exibição derivada', descricao: 'Vínculo ao equipamento; exibe IDENTIFICACAO ou DESCRICAO.' },
  status: { origem: 'ORDEMSERVICO.CHAVESITUACAOOS + TABELAS', tipo: 'FK / situação de atendimento', descricao: 'Situação de atendimento nativa do CHERP. A plataforma lê e grava esse mesmo campo.' },
  prioridade: { origem: 'ORDEMSERVICO.PRIORIDADE', tipo: 'INTEGER', descricao: 'Prioridade nativa do CHERP: Normal, Baixa, Média e Alta. A plataforma lê e grava esse mesmo campo.' },
  responsavel: { origem: 'os_workflow.responsavel_id', tipo: 'UUID', descricao: 'Responsável interno da aplicação; não existe campo equivalente no CHERP.' },
  tecnico: { origem: 'os_workflow.tecnico_id', tipo: 'UUID', descricao: 'Técnico interno da aplicação; não existe campo equivalente no CHERP.' },
  previsao: { origem: 'os_workflow.data_prevista', tipo: 'TIMESTAMP', descricao: 'Previsão interna da aplicação; não existe campo equivalente no CHERP.' },
  dav: { origem: 'ORDEMSERVICO.NRODAV', tipo: 'texto', descricao: 'Número DAV gerado pelo CHERP. Campo somente leitura nesta integração.' },
  kmAtual: { origem: 'ORDEMSERVICO.KMATUAL', tipo: 'numérico', descricao: 'Quilometragem registrada na abertura. Leitura e escrita.' },
  kmFinal: { origem: 'ORDEMSERVICO.KMFINAL', tipo: 'numérico', descricao: 'Quilometragem registrada na entrega. Leitura e escrita.' },
  diagnostico: { origem: 'ORDEMSERVICO.LAUDOTECNICO', tipo: 'texto', descricao: 'Diagnóstico técnico da OS. Leitura e escrita.' },
  observacoes: { origem: 'ORDEMSERVICO.OBS', tipo: 'texto', descricao: 'Campo "Observação" do CHERP, texto livre. Leitura e escrita.' },
  totais: { origem: 'ORDEMSERVICO.TOTALPRODUTO, TOTALSERVICO, TOTALOS', tipo: 'numérico', descricao: 'Recalculados no Firebird a partir dos itens ativos dentro de transação.' },
};

/** Origem técnica do campo no CHERP: só pra quem administra o sistema — pro mecânico é ruído (nome de tabela/coluna). */
export function OSFieldInfo({ field, children }: { field: FieldKey; children: ReactNode }) {
  const item = metadata[field];
  if (!hasPermission('SYSTEM_SETTINGS')) return <span className={styles.label}>{children}</span>;
  return <span className={styles.label}>{children}<Tooltip content={`CHERP/integração\nOrigem: ${item.origem}\nTipo: ${item.tipo}\n${item.descricao}`}><button type="button" className={styles.info} aria-label={`Detalhes técnicos de ${String(children)}`}>ⓘ</button></Tooltip></span>;
}
