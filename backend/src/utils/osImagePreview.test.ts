import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { gerarMiniaturaOS } from './osImagePreview.js';

describe('miniatura da foto da OS', () => {
  it('entrega WebP menor que a imagem original em dimensões', async () => {
    const original = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#cc4422' } }).png().toBuffer();
    const miniatura = await gerarMiniaturaOS(original);
    const metadata = await sharp(miniatura).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(480);
    expect(metadata.height).toBe(360);
    expect(miniatura.length).toBeLessThan(original.length);
  });
});
