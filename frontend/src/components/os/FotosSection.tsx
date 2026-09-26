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
import { Modal } from '../ui/Modal.js';
import { getUserErrorMessage } from '../../utils/errorPresentation.js';
import styles from './FotosSection.module.css';

interface FotosSectionProps {
  id: string;
  podeEditar: boolean;
}

const MAX_UPLOAD_BYTES = 7.5 * 1024 * 1024; // margem para o corpo multipart no limite de 8 MB do proxy
const FORMATOS_ACEITOS = new Set(['image/png', 'image/jpeg', 'image/webp']);

function FotoCard({ id, imagem, podeEditar, onExcluir, excluindo }: {
  id: string;
  imagem: OSImagemDTO;
  podeEditar: boolean;
  onExcluir: () => void;
  excluindo: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [miniatura, setMiniatura] = useState<string | null>(null);
  const [erroMiniatura, setErroMiniatura] = useState(false);
  const [aberta, setAberta] = useState(false);
  const [fotoCompleta, setFotoCompleta] = useState<string | null>(null);
  const [erroCompleta, setErroCompleta] = useState(false);
  const [tentativaCompleta, setTentativaCompleta] = useState(0);

  useEffect(() => {
    const element = cardRef.current;
    if (!element || !('IntersectionObserver' in window)) {
      setVisivel(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisivel(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    const controller = new AbortController();
    let url: string | null = null;
    void carregarImagemComoObjectUrl(id, imagem.identificador, true, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) URL.revokeObjectURL(value);
        else {
          url = value;
          setMiniatura(value);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setErroMiniatura(true); });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, imagem.identificador, visivel, tentativa]);

  useEffect(() => {
    if (!aberta) return;
    const controller = new AbortController();
    let url: string | null = null;
    void carregarImagemComoObjectUrl(id, imagem.identificador, false, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) URL.revokeObjectURL(value);
        else {
          url = value;
          setFotoCompleta(value);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setErroCompleta(true); });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, imagem.identificador, aberta, tentativaCompleta]);

  const nome = imagem.descricao || imagem.nomeArquivo;
  return (
    <div ref={cardRef} className={styles.card}>
      {erroMiniatura ? (
        <button type="button" className={styles.retryPhoto} onClick={() => { setErroMiniatura(false); setMiniatura(null); setTentativa((value) => value + 1); }}>
          Não foi possível carregar. Tentar novamente
        </button>
      ) : miniatura ? (
        <button type="button" className={styles.openPhoto} onClick={() => { setFotoCompleta(null); setErroCompleta(false); setAberta(true); }} aria-label={`Abrir foto ${nome}`}>
          <img src={miniatura} alt={nome} className={styles.thumb} decoding="async" />
        </button>
      ) : <Skeleton height={120} />}
      <div className={styles.legenda}>{nome}</div>
      {podeEditar && (
        <button type="button" className={styles.excluirButton} aria-label={`Remover ${nome}`} disabled={excluindo} onClick={onExcluir}>
          <ActionIcon name="delete" size={18} />
        </button>
      )}
      <Modal open={aberta} title={nome} onClose={() => setAberta(false)} centerOnMobile>
        {erroCompleta ? (
          <div className={styles.photoError} role="alert">
            <p>Não foi possível abrir a foto.</p>
            <Button variant="secondary" onClick={() => { setErroCompleta(false); setFotoCompleta(null); setTentativaCompleta((value) => value + 1); }}>Tentar novamente</Button>
          </div>
        ) : fotoCompleta ? (
          <img src={fotoCompleta} alt={nome} className={styles.fullPhoto} />
        ) : <Skeleton height={240} />}
      </Modal>
    </div>
  );
}

/** Fotos da OS — gravadas em ORDEMSERVICOIMG (BLOB nativo do CHERP), tirando foto ou enviando arquivo. */
export function FotosSection({ id, podeEditar }: FotosSectionProps) {
  const { showToast } = useToast();
  const { data: imagens, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['os-imagens', id],
    queryFn: () => listarImagensOS(id),
  });

  const [enviando, setEnviando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<OSImagemDTO | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const arquivoInputRef = useRef<HTMLInputElement>(null);

  async function enviarArquivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selecionados = Array.from(files);
    const formatoInvalido = selecionados.find((file) => !FORMATOS_ACEITOS.has(file.type));
    if (formatoInvalido) {
      showToast(`A foto ${formatoInvalido.name} precisa estar em JPEG, PNG ou WebP.`, 'warning');
      return;
    }
    const arquivoGrande = selecionados.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (arquivoGrande) {
      showToast(`A foto ${arquivoGrande.name} é grande demais. Escolha uma com até 7,5 MB.`, 'warning');
      return;
    }
    setEnviando(true);
    let enviados = 0;
    try {
      for (const file of selecionados) {
        await enviarImagemOS(id, file);
        enviados++;
      }
      await refetch();
      showToast(files.length > 1 ? 'Imagens enviadas.' : 'Imagem enviada.', 'success');
    } catch (err) {
      if (enviados > 0) await refetch().catch(() => undefined);
      const parcial = enviados > 0 ? `${enviados} foto(s) enviada(s). ` : '';
      showToast(`${parcial}${getUserErrorMessage(err, 'Não foi possível enviar a imagem. Tente novamente.')}`, 'danger');
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
      showToast(getUserErrorMessage(err, 'Não foi possível remover a imagem. Tente novamente.'), 'danger');
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
            accept="image/jpeg,image/png,image/webp"
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
            accept="image/jpeg,image/png,image/webp"
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
            <FotoCard key={`${id}:${img.identificador}`} id={id} imagem={img} podeEditar={podeEditar}
              excluindo={excluindoId === img.identificador} onExcluir={() => setConfirmando(img)} />
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
