import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { detectarTipoImagem } from './imageSignature.js';

/**
 * `logoUrl` salvo em Configurações pode ser um caminho servido por `/api/uploads/...` (upload local) —
 * o `@react-pdf/renderer` roda no Node e não resolve esse caminho relativo como arquivo nem como URL
 * (falta host). Por isso, pra gerar PDF, convertemos o upload local em data URI (bytes já embutidos);
 * WebP é convertido para PNG, pois o renderizador de PDF só aceita PNG/JPEG.
 * Sem logo configurada, usa a marca padrão exibida no app.
 * Uma URL http(s) externa passa direto, pois o react-pdf consegue buscá-la sozinho.
 */
export async function resolverLogoParaPdf(logoUrl: string): Promise<string> {
  if (!logoUrl) {
    try {
      const logoPadrao = await readFile(resolve(process.cwd(), '..', 'img', 'logo-transparent-640.png'));
      return `data:image/png;base64,${logoPadrao.toString('base64')}`;
    } catch {
      return '';
    }
  }
  if (logoUrl.startsWith('data:image/webp;base64,')) {
    try {
      const webp = Buffer.from(logoUrl.slice('data:image/webp;base64,'.length), 'base64');
      const png = await sharp(webp).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      return '';
    }
  }
  if (!logoUrl.startsWith('/api/uploads/')) return logoUrl;
  try {
    const caminho = resolve(process.cwd(), logoUrl.replace(/^\/api\//, ''));
    const buffer = await readFile(caminho);
    const tipo = detectarTipoImagem(buffer);
    if (!tipo) return '';
    const imagem = tipo.mime === 'image/webp' ? await sharp(buffer).png().toBuffer() : buffer;
    const mime = tipo.mime === 'image/webp' ? 'image/png' : tipo.mime;
    return `data:${mime};base64,${imagem.toString('base64')}`;
  } catch {
    return '';
  }
}
