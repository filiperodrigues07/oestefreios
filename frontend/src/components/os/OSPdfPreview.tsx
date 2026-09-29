import { useEffect, useState } from 'react';
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
        arquivo ? <iframe className={styles.preview} title={`OS #${os.numero} em PDF`} src={arquivo.url} /> :
          <p role="status">Gerando PDF da OS...</p>}
    </Modal>
  );
}
