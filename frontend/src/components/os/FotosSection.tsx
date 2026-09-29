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

/** No app instalado no iOS, o seletor nativo oferece "Tirar foto" sem forçar capture. */
function capturaDiretaDisponivel(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalado = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !ios || !instalado;
}

/** Nome sequencial ("Img. 3") — igual ao do PDF da OS; descrição só entra se foi escrita à mão. */
function nomeDaFoto(imagem: OSImagemDTO, numero: number): string {
  const descricao = imagem.descricao?.trim();
  return descricao && descricao !== imagem.nomeArquivo ? `Img. ${numero} · ${descricao}` : `Img. ${numero}`;
}

function FotoCard({ id, imagem, numero, podeEditar, onExcluir, excluindo }: {
  id: string;
  imagem: OSImagemDTO;
  numero: number;
  podeEditar: boolean;
  onExcluir: () => void;
  excluindo: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [miniatura, setMiniatura] = useState<string | null>(null);
  const [erroMiniatura, setErroMiniatura] = useState<string | null>(null);
  const [aberta, setAberta] = useState(false);
  const [fotoCompleta, setFotoCompleta] = useState<string | null>(null);
  const [erroCompleta, setErroCompleta] = useState<string | null>(null);
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
      .catch((err) => { if (!controller.signal.aborted) setErroMiniatura(getUserErrorMessage(err, 'Não foi possível carregar a foto.')); });
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
      .catch((err) => { if (!controller.signal.aborted) setErroCompleta(getUserErrorMessage(err, 'Não foi possível abrir a foto.')); });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, imagem.identificador, aberta, tentativaCompleta]);

  const nome = nomeDaFoto(imagem, numero);
  return (
    <div ref={cardRef} className={styles.card}>
      {erroMiniatura ? (
        <button type="button" className={styles.retryPhoto} onClick={() => { setErroMiniatura(null); setMiniatura(null); setTentativa((value) => value + 1); }}>
          <span role="alert">{erroMiniatura}</span>
          <span>Tentar novamente</span>
        </button>
      ) : miniatura ? (
        <button type="button" className={styles.openPhoto} onClick={() => { setFotoCompleta(null); setErroCompleta(null); setAberta(true); }} aria-label={`Abrir foto ${nome}`}>
          <img src={miniatura} alt={nome} className={styles.thumb} decoding="async" onError={() => setErroMiniatura("Não foi possível exibir a foto. Tente novamente.")} />
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
            <p>{erroCompleta}</p>
            <Button variant="secondary" onClick={() => { setErroCompleta(null); setFotoCompleta(null); setTentativaCompleta((value) => value + 1); }}>Tentar novamente</Button>
          </div>
        ) : fotoCompleta ? (
          <img src={fotoCompleta} alt={nome} className={styles.fullPhoto} onError={() => setErroCompleta("Não foi possível exibir a foto. Tente novamente.")} />
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
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<OSImagemDTO | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const arquivoInputRef = useRef<HTMLInputElement>(null);
  const capturaDireta = capturaDiretaDisponivel();

  function abrirSeletor(input: HTMLInputElement | null) {
    if (!input) return;
    // Limpa antes de abrir: após "Usar foto" o arquivo continua associado ao input até o upload.
    input.value = '';
    input.click();
  }

  async function enviarArquivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErroAcao(null);
    const selecionados = Array.from(files);
    const formatoInvalido = selecionados.find((file) => !FORMATOS_ACEITOS.has(file.type));
    if (formatoInvalido) {
      const mensagem = `A foto ${formatoInvalido.name} precisa estar em JPEG, PNG ou WebP.`;
      setErroAcao(mensagem);
      showToast(mensagem, 'warning');
      return;
    }
    const arquivoGrande = selecionados.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (arquivoGrande) {
      const mensagem = `A foto ${arquivoGrande.name} é grande demais. Escolha uma com até 7,5 MB.`;
      setErroAcao(mensagem);
      showToast(mensagem, 'warning');
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
      setErroAcao(null);
      showToast(files.length > 1 ? 'Imagens enviadas.' : 'Imagem enviada.', 'success');
    } catch (err) {
      const parcial = enviados > 0 ? `${enviados} foto(s) enviada(s). ` : '';
      const mensagem = `${parcial}${getUserErrorMessage(err, 'Não foi possível confirmar o envio da foto.')} Confira a lista antes de tentar novamente.`;
      setErroAcao(mensagem);
      showToast(mensagem, 'danger');
      void refetch().catch(() => undefined);
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
      setErroAcao(null);
      showToast('Imagem removida.', 'success');
    } catch (err) {
      const mensagem = getUserErrorMessage(err, 'Não foi possível remover a imagem. Tente novamente.');
      setErroAcao(mensagem);
      showToast(mensagem, 'danger');
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
            capture={capturaDireta ? "environment" : undefined}
            hidden
            onChange={(e) => { void enviarArquivos(e.target.files); }}
          />
          <input
            ref={arquivoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => { void enviarArquivos(e.target.files); }}
          />
          <Button size="sm" variant="secondary" loading={enviando} onClick={() => abrirSeletor(cameraInputRef.current)}>
            <ActionIcon name="camera" />
            Tirar foto
          </Button>
          <Button size="sm" variant="secondary" loading={enviando} onClick={() => abrirSeletor(arquivoInputRef.current)}>
            Enviar arquivo
          </Button>
        </div>
      )}

      {enviando && <p className={styles.uploadStatus} role="status">Enviando foto. Aguarde a confirmação antes de sair desta tela.</p>}
      {erroAcao && (
        <div className={styles.actionError} role="alert">
          <p>{erroAcao}</p>
          <Button size="sm" variant="secondary" onClick={() => { void refetch(); }}>Atualizar fotos</Button>
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
          {imagens.map((img, indice) => (
            <FotoCard key={`${id}:${img.identificador}`} id={id} imagem={img} numero={indice + 1} podeEditar={podeEditar}
              excluindo={excluindoId === img.identificador} onExcluir={() => setConfirmando(img)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmando !== null}
        title="Remover foto?"
        description={`"${confirmando && imagens ? nomeDaFoto(confirmando, imagens.indexOf(confirmando) + 1) : ''}" será removida da OS.`}
        confirmLabel="Remover"
        danger
        loading={excluindoId !== null}
        onCancel={() => setConfirmando(null)}
        onConfirm={() => void confirmarExclusao()}
      />
    </div>
  );
}
