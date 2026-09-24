import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  carregarImagemComoObjectUrl,
  enviarImagemOS,
  excluirImagemOS,
  listarImagensOS,
  type OSImagemDTO,
} from '../../api/osImagens.api.js';
import { ActionIcon, Button, ConfirmDialog, EmptyState, ErrorState, Skeleton, useToast } from '../ui/index.js';
import styles from './FotosSection.module.css';

interface FotosSectionProps {
  id: string;
  podeEditar: boolean;
}

/** Fotos da OS — gravadas em ORDEMSERVICOIMG (BLOB nativo do CHERP), tirando foto ou enviando arquivo. */
export function FotosSection({ id, podeEditar }: FotosSectionProps) {
  const { showToast } = useToast();
  const { data: imagens, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['os-imagens', id],
    queryFn: () => listarImagensOS(id),
  });

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<OSImagemDTO | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const arquivoInputRef = useRef<HTMLInputElement>(null);
  const urlsAtuaisRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      if (!imagens || imagens.length === 0) {
        urlsAtuaisRef.current.forEach((url) => URL.revokeObjectURL(url));
        urlsAtuaisRef.current = [];
        setUrls({});
        return;
      }
      const entradas = await Promise.all(
        imagens.map(async (img) => [img.identificador, await carregarImagemComoObjectUrl(id, img.identificador)] as const),
      );
      if (cancelado) {
        entradas.forEach(([, url]) => URL.revokeObjectURL(url));
        return;
      }
      urlsAtuaisRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsAtuaisRef.current = entradas.map(([, url]) => url);
      setUrls(Object.fromEntries(entradas));
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [imagens, id]);

  // Revoga tudo que restar quando a seção sai da tela (troca de OS, navegação pra fora).
  useEffect(() => () => urlsAtuaisRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function enviarArquivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setEnviando(true);
    try {
      for (const file of Array.from(files)) {
        await enviarImagemOS(id, file);
      }
      await refetch();
      showToast(files.length > 1 ? 'Imagens enviadas.' : 'Imagem enviada.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.', 'danger');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarExclusao() {
    if (!confirmando) return;
    setExcluindoId(confirmando.identificador);
    try {
      await excluirImagemOS(id, confirmando.identificador);
      await refetch();
      showToast('Imagem removida.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível remover a imagem.', 'danger');
    } finally {
      setExcluindoId(null);
      setConfirmando(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      {podeEditar && (
        <div className={styles.acoes}>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              void enviarArquivos(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={arquivoInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void enviarArquivos(e.target.files);
              e.target.value = '';
            }}
          />
          <Button size="sm" variant="secondary" loading={enviando} onClick={() => cameraInputRef.current?.click()}>
            <ActionIcon name="camera" />
            Tirar foto
          </Button>
          <Button size="sm" variant="secondary" loading={enviando} onClick={() => arquivoInputRef.current?.click()}>
            Enviar arquivo
          </Button>
        </div>
      )}

      {isLoading && (
        <div className={styles.grid}>
          <Skeleton height={120} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      )}

      {isError && <ErrorState error={error} action={<Button variant="secondary" onClick={() => refetch()}>Tentar de novo</Button>} />}

      {!isLoading && !isError && imagens?.length === 0 && (
        <EmptyState title="Nenhuma foto anexada ainda." />
      )}

      {!isLoading && !isError && imagens && imagens.length > 0 && (
        <div className={styles.grid}>
          {imagens.map((img) => (
            <div key={img.identificador} className={styles.card}>
              {urls[img.identificador] ? (
                <img src={urls[img.identificador]} alt={img.descricao || img.nomeArquivo} className={styles.thumb} />
              ) : (
                <Skeleton height={120} />
              )}
              <div className={styles.legenda}>{img.descricao || img.nomeArquivo}</div>
              {podeEditar && (
                <button
                  type="button"
                  className={styles.excluirButton}
                  aria-label={`Remover ${img.descricao || img.nomeArquivo}`}
                  disabled={excluindoId === img.identificador}
                  onClick={() => setConfirmando(img)}
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmando !== null}
        title="Remover foto?"
        description={`"${confirmando?.descricao || confirmando?.nomeArquivo}" será removida da OS.`}
        confirmLabel="Remover"
        danger
        loading={excluindoId !== null}
        onCancel={() => setConfirmando(null)}
        onConfirm={() => void confirmarExclusao()}
      />
    </div>
  );
}
