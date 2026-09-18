import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { detectarTipoImagem } from './imageSignature.js';

/**
 * `logoUrl` salvo em Configurações pode ser um caminho servido por `/api/uploads/...` (upload local) —
 * o `@react-pdf/renderer` roda no Node e não resolve esse caminho relativo como arquivo nem como URL
 * (falta host). Por isso, pra gerar PDF, convertemos o upload local em data URI (bytes já embutidos);
 * uma URL http(s) externa passa direto, pois o react-pdf consegue buscá-la sozinho.
 */
export async function resolverLogoParaPdf(logoUrl: string): Promise<string> {
  if (!logoUrl.startsWith('/api/uploads/')) return logoUrl;
  try {
    const caminho = resolve(process.cwd(), logoUrl.replace(/^\/api\//, ''));
    const buffer = await readFile(caminho);
    const tipo = detectarTipoImagem(buffer);
    if (!tipo) return '';
    return `data:${tipo.mime};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}
