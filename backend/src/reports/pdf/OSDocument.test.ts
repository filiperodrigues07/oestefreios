import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { exportarOSPdf } from '../../services/reportExport.service.js';
import { fotoParaPdf } from '../../utils/osPhotoPdf.js';
import type { OperationalOSDTO } from '../../dto/os.dto.js';

const os: OperationalOSDTO = {
  id: '1', numero: 77, clienteCodigo: '1', equipamentoCodigo: '1',
  status: 'ABERTA', prioridade: 'NORMAL', problema: '',
  produtos: [], servicos: [], historico: [], dataAbertura: new Date().toISOString(),
  kmAtual: 100, kmFinal: 100,
};
const branding = { nomeEmpresa: 'Oficina', logoUrl: '', corDestaque: '#0369a1' };
function paginas(pdf: Buffer) {
  return (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
}
describe('PDF de impressão da OS', () => {
  it('gera sem fotos', async () => {
    const pdf = await exportarOSPdf(os, branding);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(paginas(pdf)).toBe(1);
  });
  it('anexa fotos em páginas após a OS, em ordem', async () => {
    const src = await fotoParaPdf(await sharp({
      create: { width: 12, height: 12, channels: 3, background: '#123456' },
    }).webp().toBuffer());
    const fotos = [1, 2, 3].map((i) => ({
      descricao: `Foto ${i}`, nomeArquivo: `foto-${i}.webp`,
      data: new Date().toISOString(), src,
    }));
    const pdf = await exportarOSPdf(os, branding, fotos);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(paginas(pdf)).toBe(3);
  });
});
