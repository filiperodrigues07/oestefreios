import sharp from 'sharp';

/**
 * Corrige a orientação EXIF e converte os formatos aceitos para JPEG estável no PDF.
 * A foto entra no PDF numa célula de ~250pt de largura: 900px já dá ~250 dpi, então mais que isso
 * só deixaria o PDF (e a prévia na tela) mais pesado sem ganho visível na impressão.
 */
export async function fotoParaPdf(buffer: Buffer): Promise<string> {
  const jpeg = await sharp(buffer).rotate()
    .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** Roda `fn` sobre os itens com no máximo `limite` em andamento, mantendo a ordem do resultado. */
export async function mapearComLimite<T, R>(itens: T[], limite: number, fn: (item: T, indice: number) => Promise<R>): Promise<R[]> {
  const resultado = new Array<R>(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const indice = proximo++;
      resultado[indice] = await fn(itens[indice]!, indice);
    }
  });
  await Promise.all(trabalhadores);
  return resultado;
}
