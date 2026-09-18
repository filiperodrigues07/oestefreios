import { apiFetch, apiFetchBlob, apiFetchMultipart } from './httpClient.js';

export interface OSImagemDTO {
  identificador: string;
  descricao: string;
  nomeArquivo: string;
  data: string;
}

/** Fotos da OS — gravadas em ORDEMSERVICOIMG (BLOB nativo do CHERP), nunca num armazenamento paralelo. */
export const listarImagensOS = (id: string) => apiFetch<OSImagemDTO[]>(`/os/${id}/imagens`);

export function enviarImagemOS(id: string, file: File, descricao?: string): Promise<OSImagemDTO[]> {
  const formData = new FormData();
  formData.append('imagem', file);
  if (descricao) formData.append('descricao', descricao);
  return apiFetchMultipart<OSImagemDTO[]>(`/os/${id}/imagens`, formData);
}

export const excluirImagemOS = (id: string, identificador: string) =>
  apiFetch<OSImagemDTO[]>(`/os/${id}/imagens/${identificador}`, { method: 'DELETE' });

/** Baixa os bytes da imagem e devolve uma object URL pra exibir num `<img>` — a rota exige token, não dá pra usar direto como `src`. */
export async function carregarImagemComoObjectUrl(id: string, identificador: string): Promise<string> {
  const blob = await apiFetchBlob(`/os/${id}/imagens/${identificador}`);
  return URL.createObjectURL(blob);
}
