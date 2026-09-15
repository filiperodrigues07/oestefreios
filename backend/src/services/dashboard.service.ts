import type {
  AdminDashboardDTO,
  OSSummaryDTO,
  OperationalDashboardDTO,
  RankingItem,
  TecnicoCount,
} from '../dto/dashboard.dto.js';
import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser, Permission } from '../types/auth.types.js';
import type { OrdemServico, OSPrioridade, OSStatus } from '../types/cherp.types.js';

const STATUS_VALUES: OSStatus[] = [
  'ABERTA',
  'EM_ANALISE',
  'EM_ANDAMENTO',
  'AGUARDANDO_PECA',
  'AGUARDANDO_CLIENTE',
  'CONCLUIDA',
  'CANCELADA',
];

const PRIORIDADE_VALUES: OSPrioridade[] = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'];

function zeroedStatusCounts(): Record<OSStatus, number> {
  return Object.fromEntries(STATUS_VALUES.map((s) => [s, 0])) as Record<OSStatus, number>;
}

function zeroedPrioridadeCounts(): Record<OSPrioridade, number> {
  return Object.fromEntries(PRIORIDADE_VALUES.map((p) => [p, 0])) as Record<OSPrioridade, number>;
}

function rankTop(items: Map<string, RankingItem>, limit: number): RankingItem[] {
  return [...items.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, limit);
}

async function getAllOS(): Promise<OrdemServico[]> {
  const { items } = await osRepository.listar({ limit: 1000 });
  return items;
}

export async function getAdminDashboard(permissions: Permission[]): Promise<AdminDashboardDTO> {
  const todasOS = await getAllOS();

  const countsByStatus = zeroedStatusCounts();
  const countsByPrioridade = zeroedPrioridadeCounts();
  const porTecnicoMap = new Map<string, number>();
  const produtosMap = new Map<string, RankingItem>();
  const servicosMap = new Map<string, RankingItem>();

  let somaHorasConclusao = 0;
  let qtdConcluidasComData = 0;

  for (const os of todasOS) {
    countsByStatus[os.status]++;
    countsByPrioridade[os.prioridade]++;

    if (os.tecnicoId) {
      porTecnicoMap.set(os.tecnicoId, (porTecnicoMap.get(os.tecnicoId) ?? 0) + 1);
    }

    for (const p of os.produtos) {
      const atual = produtosMap.get(p.produtoCodigo);
      produtosMap.set(p.produtoCodigo, {
        codigo: p.produtoCodigo,
        descricao: p.descricao,
        quantidade: (atual?.quantidade ?? 0) + p.quantidade,
      });
    }

    for (const s of os.servicos) {
      const atual = servicosMap.get(s.servicoCodigo);
      servicosMap.set(s.servicoCodigo, {
        codigo: s.servicoCodigo,
        descricao: s.descricao,
        quantidade: (atual?.quantidade ?? 0) + s.quantidade,
      });
    }

    if (os.status === 'CONCLUIDA' && os.dataConclusao) {
      const horas = (new Date(os.dataConclusao).getTime() - new Date(os.dataAbertura).getTime()) / 3_600_000;
      somaHorasConclusao += horas;
      qtdConcluidasComData++;
    }
  }

  const porTecnico: TecnicoCount[] = [...porTecnicoMap.entries()]
    .map(([tecnicoId, count]) => ({ tecnicoId, count }))
    .sort((a, b) => b.count - a.count);

  const dashboard: AdminDashboardDTO = {
    countsByStatus,
    countsByPrioridade,
    porTecnico,
    tempoMedioConclusaoHoras: qtdConcluidasComData > 0 ? somaHorasConclusao / qtdConcluidasComData : null,
    produtosMaisUtilizados: rankTop(produtosMap, 5),
    servicosMaisUtilizados: rankTop(servicosMap, 5),
  };

  if (permissions.includes('FINANCIAL_VIEW')) {
    const concluidasOuAndamento = todasOS.filter((os) => os.faturamento !== undefined);
    const faturamentoTotal = concluidasOuAndamento.reduce((acc, os) => acc + (os.faturamento ?? 0), 0);
    const valorProdutos = todasOS.reduce(
      (acc, os) => acc + os.produtos.reduce((s, p) => s + (p.total ?? 0), 0),
      0,
    );
    const valorServicos = todasOS.reduce(
      (acc, os) => acc + os.servicos.reduce((s, srv) => s + (srv.total ?? 0), 0),
      0,
    );
    dashboard.financeiro = {
      faturamentoTotal,
      valorProdutos,
      valorServicos,
      ticketMedio: concluidasOuAndamento.length > 0 ? faturamentoTotal / concluidasOuAndamento.length : 0,
    };
  }

  return dashboard;
}

function toSummaryDTO(os: OrdemServico): OSSummaryDTO {
  return {
    id: os.id,
    numero: os.numero,
    clienteCodigo: os.clienteCodigo,
    equipamentoCodigo: os.equipamentoCodigo,
    status: os.status,
    prioridade: os.prioridade,
    dataAbertura: os.dataAbertura,
  };
}

export async function getOperationalDashboard(usuario: AuthenticatedUser): Promise<OperationalDashboardDTO> {
  const todasOS = await getAllOS();
  const minhas = todasOS.filter((os) => os.tecnicoId === usuario.id || os.responsavelId === usuario.id);

  const counts = { pendentes: 0, emAndamento: 0, aguardando: 0, concluidas: 0 };
  for (const os of minhas) {
    if (os.status === 'ABERTA' || os.status === 'EM_ANALISE') counts.pendentes++;
    else if (os.status === 'EM_ANDAMENTO') counts.emAndamento++;
    else if (os.status === 'AGUARDANDO_PECA' || os.status === 'AGUARDANDO_CLIENTE') counts.aguardando++;
    else if (os.status === 'CONCLUIDA') counts.concluidas++;
  }

  const minhasOS = minhas
    .sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime())
    .slice(0, 20)
    .map(toSummaryDTO);

  return { counts, minhasOS };
}
