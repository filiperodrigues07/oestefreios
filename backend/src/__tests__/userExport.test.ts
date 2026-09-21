import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { exportUsersExcelHandler } from '../controllers/user.controller.js';
import { listUsers } from '../services/user.service.js';

vi.mock('../services/user.service.js', () => ({ listUsers: vi.fn() }));

describe('exportação de usuários', () => {
  it('aplica filtros e gera Excel seguro', async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { id: '1', name: '=Ana', email: 'ana@example.com', roleId: 'admin', roleName: 'Administrador', isActive: true, cherpUsuarioChave: 42 },
      { id: '2', name: 'Bruno', email: 'bruno@example.com', roleId: 'admin', roleName: 'Administrador', isActive: false, cherpUsuarioChave: null },
    ] as Awaited<ReturnType<typeof listUsers>>);
    let result: Buffer | undefined;
    const response = {
      setHeader: vi.fn(),
      send: vi.fn((body: Buffer) => { result = body; }),
    } as unknown as Response;
    await exportUsersExcelHandler({ query: { roleId: 'admin', status: 'ativo', vinculo: 'vinculado' } } as unknown as Request, response);

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result! as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('Usuários')!;
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getCell('A2').value).toBe("'=Ana");
    expect(sheet.getCell('E2').value).toBe(42);
  });
});
