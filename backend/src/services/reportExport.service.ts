import ExcelJS from 'exceljs';
import { renderToBuffer } from '@react-pdf/renderer';
import type { RelatorioResultado } from '../dto/relatorio.dto.js';
import type { AdminOSDTO, OperationalOSDTO } from '../dto/os.dto.js';
import { RelatorioDocument } from '../reports/pdf/RelatorioDocument.js';
import { OSDocument } from '../reports/pdf/OSDocument.js';

export interface RelatorioBranding {
  nomeEmpresa: string;
  logoUrl: string;
  corDestaque: string;
}

const COR_PADRAO = '0369A1';

function hexToArgb(hex: string): string {
  const limpo = hex.replace('#', '').trim();
  const valido = /^[0-9a-fA-F]{6}$/.test(limpo) ? limpo : COR_PADRAO;
  return `FF${valido.toUpperCase()}`;
}

function formatarData(valor: string | Date): string {
  return new Date(valor).toLocaleDateString('pt-BR');
}

/** Evita que texto vindo do CHERP seja executado como fórmula ao abrir o Excel. */
function valorSeguroParaExcel(valor: string | number | boolean | null | undefined): string | number | boolean | null | undefined {
  return typeof valor === 'string' && /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

export async function exportarExcel(relatorio: RelatorioResultado, branding: RelatorioBranding): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = branding.nomeEmpresa;
  workbook.created = new Date();

  const nomeAba = relatorio.titulo.slice(0, 31);
  const sheet = workbook.addWorksheet(nomeAba);
  const totalColunas = relatorio.colunas.length;
  const corFundo = hexToArgb(branding.corDestaque);

  sheet.mergeCells(1, 1, 1, totalColunas);
  const tituloCell = sheet.getCell(1, 1);
  tituloCell.value = `${branding.nomeEmpresa} — ${relatorio.titulo}`;
  tituloCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundo } };
  tituloCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 28;

  let proximaLinha = 2;
  if (relatorio.periodo) {
    sheet.mergeCells(proximaLinha, 1, proximaLinha, totalColunas);
    const periodoCell = sheet.getCell(proximaLinha, 1);
    periodoCell.value = `Período: ${formatarData(relatorio.periodo.inicio)} a ${formatarData(relatorio.periodo.fim)}`;
    periodoCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    proximaLinha++;
  }
  sheet.mergeCells(proximaLinha, 1, proximaLinha, totalColunas);
  const geradoCell = sheet.getCell(proximaLinha, 1);
  geradoCell.value = `Gerado em ${new Date(relatorio.geradoEm).toLocaleString('pt-BR')}`;
  geradoCell.font = { italic: true, size: 9, color: { argb: 'FF94A3B8' } };
  proximaLinha += 2;

  const headerRowIndex = proximaLinha;
  const headerRow = sheet.getRow(headerRowIndex);
  relatorio.colunas.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundo } };
    cell.alignment = { horizontal: col.alinhamento ?? 'left' };
  });

  relatorio.linhas.forEach((linha, rowIdx) => {
    const row = sheet.getRow(headerRowIndex + 1 + rowIdx);
    relatorio.colunas.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const valor = linha[col.key];
      if (col.tipo === 'moeda' && typeof valor === 'number') {
        cell.value = valor;
        cell.numFmt = '"R$" #,##0.00';
      } else if (col.tipo === 'data' && valor) {
        cell.value = new Date(valor as string);
        cell.numFmt = 'dd/mm/yyyy';
      } else {
        cell.value = valor === null || valor === undefined ? '—' : valorSeguroParaExcel(valor);
      }
      cell.alignment = { horizontal: col.alinhamento ?? 'left' };
      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  sheet.columns.forEach((col, i) => {
    const coluna = relatorio.colunas[i];
    if (!coluna) return;
    let max = coluna.label.length;
    for (const linha of relatorio.linhas) {
      const tamanho = String(linha[coluna.key] ?? '').length;
      if (tamanho > max) max = tamanho;
    }
    col.width = Math.min(Math.max(max + 2, 12), 42);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportarPdf(relatorio: RelatorioResultado, branding: RelatorioBranding): Promise<Buffer> {
  const buffer = await renderToBuffer(RelatorioDocument({ relatorio, branding }));
  return Buffer.from(buffer);
}

export async function exportarOSPdf(os: OperationalOSDTO | AdminOSDTO, branding: RelatorioBranding): Promise<Buffer> {
  const buffer = await renderToBuffer(OSDocument({ os, branding }));
  return Buffer.from(buffer);
}
