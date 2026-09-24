import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
async function logoPadraoParaPdf(): Promise<string> {
  const caminho = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../img/logo-transparent-640.png',
  );
  const imagem = await readFile(caminho);
  return `data:image/png;base64,${imagem.toString('base64')}`;
}

export async function resolverLogoParaPdf(logoUrl: string): Promise<string> {
  if (!logoUrl) return logoPadraoParaPdf();
  if (logoUrl.startsWith('data:image/webp;base64,')) {
    try {
      const webp = Buffer.from(logoUrl.slice('data:image/webp;base64,'.length), 'base64');
      const png = await sharp(webp).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      return logoPadraoParaPdf();
    }
  }
  if (!logoUrl.startsWith('/api/uploads/')) return logoUrl;
  try {
    const caminho = resolve(process.cwd(), logoUrl.replace(/^\/api\//, ''));
    const buffer = await readFile(caminho);
    const tipo = detectarTipoImagem(buffer);
    if (!tipo) return logoPadraoParaPdf();
    const imagem = tipo.mime === 'image/webp' ? await sharp(buffer).png().toBuffer() : buffer;
    const mime = tipo.mime === 'image/webp' ? 'image/png' : tipo.mime;
    return `data:${mime};base64,${imagem.toString('base64')}`;
  } catch {
    return logoPadraoParaPdf();
  }
}
