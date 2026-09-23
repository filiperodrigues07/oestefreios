import { describe, expect, it } from 'vitest';
import { getAdminDashboard, getOperationalDashboardV2 } from '../dashboard.service.js';
import { osRepository } from '../../repositories/index.js';

describe('dashboard admin: regra crítica de segurança financeira', () => {
  it('sem FINANCIAL_VIEW, o DTO não tem a chave financeiro nem nenhum campo de valor', async () => {
    const dashboard = await getAdminDashboard(['REPORT_VIEW']);
    expect(dashboard.financeiro).toBeUndefined();
    expect(JSON.stringify(dashboard)).not.toContain('faturamentoTotal');
  });

  it('com FINANCIAL_VIEW, o DTO traz os indicadores financeiros', async () => {
    const dashboard = await getAdminDashboard(['REPORT_VIEW', 'FINANCIAL_VIEW']);
    expect(dashboard.financeiro).toBeDefined();
    expect(typeof dashboard.financeiro?.faturamentoTotal).toBe('number');
  });

  it('contagens por status somam o total de OS mockadas', async () => {
    const dashboard = await getAdminDashboard(['REPORT_VIEW']);
    const total = Object.values(dashboard.countsByStatus).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('dashboard por período soma as situações nativas ao total exibido', async () => {
    const agora = new Date();
    const inicio = new Date(agora);
    inicio.setDate(inicio.getDate() - 14);
    const dashboard = await getOperationalDashboardV2({ inicio, fim: agora, granularidade: 'diario' });

    expect(Object.values(dashboard.countsByStatus).reduce((total, value) => total + value, 0)).toBe(dashboard.total);
    expect(dashboard.countsByStatus.EM_ANALISE).toBe(0);
    expect(dashboard.countsByStatus.EM_ANDAMENTO).toBe(0);
  });

  it('mantém OS antigas em aberto na fila de atenção mesmo fora do período', async () => {
    const agora = new Date();
    const inicio = new Date(agora.getTime() - 60 * 60 * 1000);
    const dashboard = await getOperationalDashboardV2({ inicio, fim: agora, granularidade: 'diario' });
    expect(dashboard.atencao.some((os) => os.numero === 1233)).toBe(true);
  });

  it('total e situação aberta conferem com a listagem no mesmo período', async () => {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 14);
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
    const dashboard = await getOperationalDashboardV2({ inicio, fim, granularidade: 'diario' });
    const todas = await osRepository.listar({ dataInicial: inicio, dataFinal: fim, incluirFinalizadas: true });
    const abertas = await osRepository.listar({ dataInicial: inicio, dataFinal: fim, situacaoDocumento: 0, incluirFinalizadas: true });

    expect(dashboard.total).toBe(todas.total);
    expect(dashboard.countsBySituacaoDocumento[0]).toBe(abertas.total);
  });
});
