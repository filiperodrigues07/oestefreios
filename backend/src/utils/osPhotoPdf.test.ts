import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { fotoParaPdf } from './osPhotoPdf.js';

describe('fotos na impressão da OS', () => {
  it.each(['jpeg', 'png', 'webp'] as const)('converte %s para JPEG do PDF', async (format) => {
    const original = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#00aa55' } })
      .toFormat(format).toBuffer();
    const src = await fotoParaPdf(original);
    expect(src.startsWith('data:image/jpeg;base64,')).toBe(true);
    const converted = Buffer.from(src.split(',')[1]!, 'base64');
    expect((await sharp(converted).metadata()).format).toBe('jpeg');
  });
  it('falha quando a imagem está corrompida', async () => {
    await expect(fotoParaPdf(Buffer.from('imagem invalida'))).rejects.toThrow();
  });
});
