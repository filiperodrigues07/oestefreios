import { useEffect, useRef, useState } from 'react';
import { readDraft, removeDraft, writeDraft } from '../../utils/drafts.js';
import { ActionIcon, Button, Modal } from '../ui/index.js';
import { formatarKm, OSKmFields, parseKm } from './OSKmFields.js';
import styles from './OSKmFields.module.css';
import type { DiagnosticoSaveResult } from './DiagnosticoSection.js';

interface KmDraft { kmAtual: string; kmFinal: string }
interface Props {
  kmAtual?: number;
  kmFinal?: number;
  podeEditar: boolean;
  salvando: boolean;
  draftStorageKey?: string;
  legacyDraftStorageKey?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (patch: { kmAtual: number; kmFinal: number; base?: { kmAtual: number | null; kmFinal: number | null } }) => Promise<DiagnosticoSaveResult>;
}

export function OSKmSection({ kmAtual, kmFinal, podeEditar, salvando, draftStorageKey, legacyDraftStorageKey, onDirtyChange, onSave }: Props) {
  const [inicial, setInicial] = useState(kmAtual === undefined ? '' : String(kmAtual));
  const [final, setFinal] = useState(kmFinal === undefined ? '' : String(kmFinal));
  const [base, setBase] = useState({ kmAtual: kmAtual ?? null, kmFinal: kmFinal ?? null });
  const [dirty, setDirty] = useState(false);
  const [conflito, setConflito] = useState(false);
  const edits = useRef(0);
  const [draftPendente, setDraftPendente] = useState(() => {
    if (!draftStorageKey) return null;
    const current = readDraft<KmDraft>(draftStorageKey);
    if (current) return current;
    const legacy = legacyDraftStorageKey
      ? readDraft<{ diagnostico?: string; observacoes?: string; kmAtual?: string; kmFinal?: string }>(legacyDraftStorageKey) : null;
    if (!legacy || (legacy.data.kmAtual === undefined && legacy.data.kmFinal === undefined)) return null;
    writeDraft(draftStorageKey, { kmAtual: legacy.data.kmAtual ?? '', kmFinal: legacy.data.kmFinal ?? '' });
    if (legacyDraftStorageKey) writeDraft(legacyDraftStorageKey, {
      diagnostico: legacy.data.diagnostico ?? '', observacoes: legacy.data.observacoes ?? '',
    });
    return readDraft<KmDraft>(draftStorageKey);
  });

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!draftStorageKey || !dirty) return;
    const timer = setTimeout(() => writeDraft(draftStorageKey, { kmAtual: inicial, kmFinal: final }), 500);
    return () => clearTimeout(timer);
  }, [draftStorageKey, dirty, inicial, final]);

  const serverKey = JSON.stringify([kmAtual, kmFinal, dirty]);
  const [previousServerKey, setPreviousServerKey] = useState(serverKey);
  if (serverKey !== previousServerKey) {
    setPreviousServerKey(serverKey);
    if (!dirty) {
      setInicial(kmAtual === undefined ? '' : String(kmAtual));
      setFinal(kmFinal === undefined ? '' : String(kmFinal));
      setBase({ kmAtual: kmAtual ?? null, kmFinal: kmFinal ?? null });
    }
  }

  function change(setter: (value: string) => void, value: string) {
    setter(value);
    edits.current += 1;
    setDirty(true);
  }

  async function salvar(sobrescrever = false) {
    const kmInicial = parseKm(inicial);
    const kmFim = parseKm(final);
    if (kmInicial === undefined || kmFim === undefined) return;
    const version = edits.current;
    const result = await onSave({ kmAtual: kmInicial, kmFinal: kmFim, base: sobrescrever ? undefined : base });
    if (result === 'conflict') { setConflito(true); return; }
    if ((result === 'ok' || result === 'queued') && version === edits.current) {
      setDirty(false);
      if (result === 'ok' && draftStorageKey) removeDraft(draftStorageKey);
    }
  }

  const atual = parseKm(inicial);
  const fim = parseKm(final);
  return <div>
    <div className={styles.cabecalho}>
      <h2 className={styles.titulo}>Quilometragem</h2>
      {podeEditar && dirty && <span className={`${styles.estado} ${styles.pendente}`} role="status">Alterações não salvas</span>}
    </div>
    {podeEditar ? <>
      {draftPendente && <div role="status" className="draft-banner">
        <span>Há um rascunho de KM não salvo.</span>
        <span className="draft-banner-actions">
          <Button size="sm" onClick={() => {
            setInicial(draftPendente.data.kmAtual);
            setFinal(draftPendente.data.kmFinal);
            setBase({ kmAtual: kmAtual ?? null, kmFinal: kmFinal ?? null });
            edits.current += 1;
            setDirty(true);
            setDraftPendente(null);
          }}>Restaurar</Button>
          <Button size="sm" variant="ghost" onClick={() => {
            if (draftStorageKey) removeDraft(draftStorageKey);
            setDraftPendente(null);
          }}>Descartar</Button>
        </span>
      </div>}
      <OSKmFields kmAtual={inicial} kmFinal={final} onKmAtualChange={(v) => change(setInicial, v)}
        onKmFinalChange={(v) => change(setFinal, v)} disabled={salvando}
        acao={<Button loading={salvando} disabled={!dirty || atual === undefined || fim === undefined}
          onClick={() => void salvar()}><ActionIcon name="save" />Salvar KM</Button>} />
    </> : <dl className={styles.leitura}>
      <div><dt>KM inicial</dt><dd>{kmAtual !== undefined ? formatarKm(kmAtual) : 'Não informado'}</dd></div>
      <div><dt>KM final</dt><dd>{kmFinal !== undefined ? formatarKm(kmFinal) : 'Não informado'}</dd></div>
      {kmAtual !== undefined && kmFinal !== undefined && kmFinal >= kmAtual
        && <div><dt>Percorrido</dt><dd>{formatarKm(kmFinal - kmAtual)}</dd></div>}
    </dl>}
    <Modal open={conflito} title="Outro usuário alterou os KM desta OS" onClose={() => setConflito(false)}
      footer={<>
        <Button variant="secondary" onClick={() => { setConflito(false); setDirty(false); if (draftStorageKey) removeDraft(draftStorageKey); }}>Usar a versão atual</Button>
        <Button onClick={() => { setConflito(false); void salvar(true); }}>Gravar a minha versão</Button>
      </>}>
      <p>Os KM mudaram enquanto você editava. Confira os valores antes de escolher.</p>
    </Modal>
  </div>;
}
