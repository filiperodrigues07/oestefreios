import { afterEach, describe, expect, it } from 'vitest';
import { dashboardOperacionalQuerySchema } from './dashboard.validator.js';
import { listarOSQuerySchema } from './os.validator.js';
import { relatorioOSQuerySchema } from './relatorio.validator.js';

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe.each(['America/Sao_Paulo', 'UTC'])('filtros por dia no fuso %s', (timezone) => {
  it('mantém os dois limites no dia escolhido para lista, dashboard e relatório', () => {
    process.env.TZ = timezone;
    const lista = listarOSQuerySchema.parse({ dataInicial: '2026-09-17', dataFinal: '2026-09-23' });
    const dashboard = dashboardOperacionalQuerySchema.parse({ inicio: '2026-09-17', fim: '2026-09-23' });
    const relatorio = relatorioOSQuerySchema.parse({ dataInicial: '2026-09-17', dataFinal: '2026-09-23' });

    for (const [inicio, fim] of [[lista.dataInicial, lista.dataFinal], [dashboard.inicio, dashboard.fim], [relatorio.dataInicial, relatorio.dataFinal]]) {
      expect(inicio?.getDate()).toBe(17);
      expect(inicio?.getHours()).toBe(0);
      expect(fim?.getDate()).toBe(23);
      expect(fim?.getHours()).toBe(23);
    }
  });
});
