import sharp from 'sharp';

/** Miniatura para a grade mobile. A imagem original continua disponível ao abrir a foto. */
export function gerarMiniaturaOS(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(480, 360, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}
