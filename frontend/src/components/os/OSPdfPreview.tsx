import { useEffect, useRef, useState } from 'react';
import type { RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { carregarOSPdf, salvarOSPdf } from '../../api/os.api.js';
import { getUserErrorMessage } from '../../utils/errorPresentation.js';
import { Button, Modal } from '../ui/index.js';
import styles from './OSPdfPreview.module.css';

interface Props {
  os: { id: string; numero: number } | null;
  onClose: () => void;
}

export function OSPdfPreview({ os, onClose }: Props) {
  return os ? <PreviewContent key={os.id} os={os} onClose={onClose} /> : null;
}

/** A URL temporária existe só enquanto a prévia está aberta. */
function PreviewContent({ os, onClose }: { os: NonNullable<Props['os']>; onClose: () => void }) {
  const [arquivo, setArquivo] = useState<{ blob: Blob; url: string } | null>(null);
  const [erro, setErro] = useState('');
  const id = os.id;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void carregarOSPdf(id, controller.signal).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setArquivo({ blob, url: objectUrl });
    }).catch((error: unknown) => {
      if (!cancelled) setErro(getUserErrorMessage(error, 'Não foi possível gerar o PDF da OS. Tente novamente.'));
    });
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <Modal open wide title={`Prévia da OS #${os.numero}`} onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
        {arquivo && <a className={styles.openLink} href={arquivo.url} target="_blank" rel="noopener noreferrer">Abrir PDF</a>}
        <Button disabled={!arquivo} onClick={() => { if (arquivo) salvarOSPdf(arquivo.blob, os.numero); }}>Baixar</Button>
      </>}>
      {erro ? <p role="alert" className={styles.error}>{erro}</p> :
        arquivo ? <PdfPages blob={arquivo.blob} /> :
          <div role="status" className={styles.loading}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>Gerando o PDF da OS...</span>
            <small>Com fotos pode levar alguns segundos.</small>
          </div>}
    </Modal>
  );
}

/** O visualizador nativo de PDF pode abrir um iframe branco no PWA do iOS. */
function PdfPages({ blob }: { blob: Blob }) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let loadingTask: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined;
    const container = pagesRef.current;
    if (!container) return;

    async function renderPdf() {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
        const pdf = await loadingTask.promise;
        for (let index = 1; index <= pdf.numPages && !cancelled; index++) {
          const page = await pdf.getPage(index);
          if (cancelled) break;
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(1.5, Math.max(0.1, container!.clientWidth / base.width));
          const viewport = page.getViewport({ scale });
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const canvas = document.createElement('canvas');
          canvas.className = styles.page!;
          canvas.width = Math.round(viewport.width * pixelRatio);
          canvas.height = Math.round(viewport.height * pixelRatio);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          container!.appendChild(canvas);
          renderTask = page.render({
            canvas,
            canvasContext: canvas.getContext('2d')!,
            viewport,
            transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
          });
          await renderTask.promise;
          renderTask = undefined;
          if (index === 1) setLoading(false);
        }
      } catch (cause) {
        if (!cancelled) setError(getUserErrorMessage(cause, 'Não foi possível mostrar a prévia. Use Abrir PDF ou Baixar.'));
      }
    }

    void renderPdf();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
      container.replaceChildren();
    };
  }, [blob]);

  return <>
    {loading && !error && <div role="status" className={styles.loading}><span className={styles.spinner} aria-hidden="true" />Preparando a prévia...</div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div ref={pagesRef} className={styles.pages} aria-label="Páginas da OS em PDF" />
  </>;
}
