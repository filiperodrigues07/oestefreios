import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { fotoParaPdf, mapearComLimite } from './osPhotoPdf.js';

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

describe('mapearComLimite', () => {
  it('mantém a ordem e respeita o limite de paralelismo', async () => {
    let ativos = 0;
    let pico = 0;
    const saida = await mapearComLimite([5, 1, 4, 2, 3, 6], 3, async (n) => {
      ativos++;
      pico = Math.max(pico, ativos);
      await new Promise((r) => setTimeout(r, n * 3));
      ativos--;
      return n * 10;
    });
    expect(saida).toEqual([50, 10, 40, 20, 30, 60]);
    expect(pico).toBeLessThanOrEqual(3);
  });
});
