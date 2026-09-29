import sharp from 'sharp';

/** Corrige a orientação EXIF e converte os formatos aceitos para JPEG estável no PDF. */
export async function fotoParaPdf(buffer: Buffer): Promise<string> {
  const jpeg = await sharp(buffer).rotate()
    .resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}
