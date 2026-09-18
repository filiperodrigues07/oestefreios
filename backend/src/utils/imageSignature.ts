const ASSINATURAS: { extensao: string; mime: string; bytes: number[] }[] = [
  { extensao: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { extensao: 'jpg', mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { extensao: 'webp', mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

/** Detecta o tipo real pelos primeiros bytes do arquivo — nunca confia no mimetype declarado pelo cliente. */
export function detectarTipoImagem(buffer: Buffer): { extensao: string; mime: string } | null {
  const encontrado = ASSINATURAS.find((assinatura) => assinatura.bytes.every((byte, index) => buffer[index] === byte));
  return encontrado ? { extensao: encontrado.extensao, mime: encontrado.mime } : null;
}
