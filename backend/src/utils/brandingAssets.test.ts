import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { Document, Image, Page, renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { resolverLogoParaPdf } from './brandingAssets.js';

describe('resolverLogoParaPdf', () => {
  it('converte logo WebP para um formato que o renderizador inclui no PDF', async () => {
    const webp = await readFile(resolve(process.cwd(), '..', 'img', 'logo-clean.webp'));
    const directory = resolve(process.cwd(), 'uploads', 'branding');
    const filename = `teste-logo-${randomUUID()}.webp`;
    const path = resolve(directory, filename);
    await mkdir(directory, { recursive: true });
    await writeFile(path, webp, { flag: 'wx' });

    let logo: string;
    try {
      logo = await resolverLogoParaPdf(`/api/uploads/branding/${filename}`);
    } finally {
      await unlink(path);
    }

    expect(logo.startsWith('data:image/png;base64,')).toBe(true);
    const pdf = await renderToBuffer(createElement(Document, null,
      createElement(Page, null, createElement(Image, { src: logo, style: { width: 42, height: 42 } }))));
    expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  });

  it('usa a marca padrão quando não há logo configurada', async () => {
    const logo = await resolverLogoParaPdf('');
    expect(logo.startsWith('data:image/png;base64,')).toBe(true);
  });
});
