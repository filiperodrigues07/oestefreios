import { describe, expect, it, vi } from 'vitest';

vi.mock('./auditLog.service.js', () => ({ recordAudit: vi.fn(async () => undefined) }));

import { osRepository } from '../repositories/index.js';
import type { AuthenticatedUser, Permission } from '../types/auth.types.js';
import { getOperationalDashboard, searchDashboard } from './dashboard.service.js';
import { alterarStatusOS, duplicarOS, getOSById, listOS } from './os.service.js';

function usuario(permissions: Permission[]): AuthenticatedUser {
  return { id: 'u-fin', email: 'x@teste.local', name: 'Teste', roleId: 'r', roleName: 'r', permissions, mustChangePassword: false };
}
const gerente = usuario(['OS_VIEW', 'OS_CREATE', 'OS_EDIT', 'OS_CHANGE_STATUS', 'OS_VIEW_FINALIZADAS']);
const mecanico = usuario(['OS_VIEW', 'OS_EDIT', 'OS_CHANGE_STATUS']);

async function osFinalizadaNoApp() {
  const { items } = await osRepository.listar({ incluirFinalizadas: true, limit: 100 });
  const origem = items.find((o) => o.numero === 1234)!;
  const os = await duplicarOS(origem.id, gerente, { kmAtual: 0, kmFinal: 0 });
  await osRepository.atualizar(os.id, { tecnicoId: mecanico.id });
  await alterarStatusOS(os.id, 'CONCLUIDA', gerente);
  return os;
}

describe('OS finalizada pelo app some pra quem não tem OS_VIEW_FINALIZADAS', () => {
  it('lista: gerente vê, mecânico não; mecânico continua abrindo por link (só leitura)', async () => {
    const os = await osFinalizadaNoApp();
    const doGerente = await listOS({ incluirFinalizadas: true, limit: 100 }, gerente.permissions);
    const doMecanico = await listOS({ incluirFinalizadas: true, limit: 100 }, mecanico.permissions);
    expect(doGerente.items.some((o) => o.id === os.id)).toBe(true);
    expect(doMecanico.items.some((o) => o.id === os.id)).toBe(false);
    expect(doMecanico.items.every((o) => !o.travadoLocal && (o.situacaoDocumento ?? 0) === 0)).toBe(true);
    expect((await getOSById(os.id, mecanico.permissions)).travadoLocal).toBe(true);
  });

  it('filtro "finalizadas no app" traz só as travadas pelo app', async () => {
    const os = await osFinalizadaNoApp();
    const { items } = await listOS({ somenteFinalizadasApp: true, limit: 100 }, gerente.permissions);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((o) => o.travadoLocal)).toBe(true);
    expect(items.some((o) => o.id === os.id)).toBe(true);
    // Sem a permissão, o filtro não revela nada.
    const semPermissao = await listOS({ somenteFinalizadasApp: true, limit: 100 }, mecanico.permissions);
    expect(semPermissao.items.some((o) => o.travadoLocal)).toBe(false);
  });

  it('"Minhas OS" e busca global também escondem', async () => {
    const os = await osFinalizadaNoApp();
    const minhas = await getOperationalDashboard(mecanico);
    expect(minhas.minhasOS.some((o) => o.id === os.id)).toBe(false);
    const busca = await searchDashboard(String(os.numero), mecanico.permissions);
    expect(busca.some((r) => r.id === os.id)).toBe(false);
  });
});
