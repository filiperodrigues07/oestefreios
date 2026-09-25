import { useEffect, useId, useRef, useState } from 'react';
import { readDraft, removeDraft, writeDraft } from '../../utils/drafts.js';
import { Button } from '../ui/index.js';

interface DiagnosticoDraft {
  diagnostico: string;
  observacoes: string;
  solucao: string;
  kmAtual: string;
  kmFinal: string;
}

export interface DiagnosticoPatch {
  diagnostico: string;
  observacoes: string;
  solucao: string;
  kmAtual?: number;
  kmFinal?: number;
}

interface DiagnosticoSectionProps {
  diagnostico?: string;
  observacoes?: string;
  solucao?: string;
  kmAtual?: number;
  kmFinal?: number;
  podeEditar: boolean;
  salvando: boolean;
  /** Resolve `true` quando a alteração foi aceita (gravada ou enfileirada offline); `false` mantém o formulário sujo. */
  onSave: (patch: DiagnosticoPatch) => Promise<boolean>;
  /** Avisa o pai quando há edição pendente não salva — usado pra confirmar antes de trocar de aba. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Chave do rascunho local (ver utils/drafts.ts); sem ela, não guarda rascunho. */
  draftStorageKey?: string;
}

/** Campos da OS com escrita na integração CHERP — sempre editáveis (sem clicar "Editar" primeiro) pra quem tem permissão. */
export function DiagnosticoSection({
  diagnostico,
  observacoes,
  solucao,
  kmAtual,
  kmFinal,
  podeEditar,
  salvando,
  onSave,
  onDirtyChange,
  draftStorageKey,
}: DiagnosticoSectionProps) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);
  const [diagnosticoForm, setDiagnosticoForm] = useState(diagnostico ?? '');
  const [observacoesForm, setObservacoesForm] = useState(observacoes ?? '');
  const [solucaoForm, setSolucaoForm] = useState(solucao ?? '');
  const [kmAtualForm, setKmAtualForm] = useState(kmAtual !== undefined ? String(kmAtual) : '');
  const [kmFinalForm, setKmFinalForm] = useState(kmFinal !== undefined ? String(kmFinal) : '');

  // Rascunho de uma sessão anterior que difere do que está gravado: oferece restaurar (nunca aplica sozinho).
  const [draftPendente, setDraftPendente] = useState(() => {
    if (!draftStorageKey) return null;
    const draft = readDraft<DiagnosticoDraft>(draftStorageKey);
    if (!draft) return null;
    const servidor: DiagnosticoDraft = {
      diagnostico: diagnostico ?? '',
      observacoes: observacoes ?? '',
      solucao: solucao ?? '',
      kmAtual: kmAtual !== undefined ? String(kmAtual) : '',
      kmFinal: kmFinal !== undefined ? String(kmFinal) : '',
    };
    if (JSON.stringify(draft.data) === JSON.stringify(servidor)) {
      removeDraft(draftStorageKey);
      return null;
    }
    return draft;
  });

  // Enquanto há edição pendente, grava o rascunho (debounce) — protege contra app fechado/celular travado.
  useEffect(() => {
    if (!draftStorageKey || !dirty) return;
    const timer = setTimeout(() => {
      writeDraft<DiagnosticoDraft>(draftStorageKey, {
        diagnostico: diagnosticoForm,
        observacoes: observacoesForm,
        solucao: solucaoForm,
        kmAtual: kmAtualForm,
        kmFinal: kmFinalForm,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [draftStorageKey, dirty, diagnosticoForm, observacoesForm, solucaoForm, kmAtualForm, kmFinalForm]);

  function restaurarDraft() {
    if (!draftPendente) return;
    setDiagnosticoForm(draftPendente.data.diagnostico);
    setObservacoesForm(draftPendente.data.observacoes);
    setSolucaoForm(draftPendente.data.solucao);
    setKmAtualForm(draftPendente.data.kmAtual);
    setKmFinalForm(draftPendente.data.kmFinal);
    edicoes.current += 1;
    setDirty(true);
    setDraftPendente(null);
  }

  function descartarDraft() {
    if (draftStorageKey) removeDraft(draftStorageKey);
    setDraftPendente(null);
  }

  // Guarda a última versão recebida; ao mudar, sincroniza somente se não há edição local.
  const serverKey = JSON.stringify([diagnostico, observacoes, solucao, kmAtual, kmFinal, dirty]);
  const [previousServerKey, setPreviousServerKey] = useState(serverKey);
  if (serverKey !== previousServerKey) {
    setPreviousServerKey(serverKey);
    if (!dirty) {
      setDiagnosticoForm(diagnostico ?? '');
      setObservacoesForm(observacoes ?? '');
      setSolucaoForm(solucao ?? '');
      setKmAtualForm(kmAtual !== undefined ? String(kmAtual) : '');
      setKmFinalForm(kmFinal !== undefined ? String(kmFinal) : '');
    }
  }

  // Conta edições: se o usuário continuar digitando enquanto o salvar está em voo, o formulário continua sujo.
  const edicoes = useRef(0);

  function alterar<T>(setter: (v: T) => void, v: T) {
    setter(v);
    edicoes.current += 1;
    setDirty(true);
  }

  async function salvar() {
    const edicoesNoEnvio = edicoes.current;
    const ok = await onSave({
      diagnostico: diagnosticoForm,
      observacoes: observacoesForm,
      solucao: solucaoForm,
      kmAtual: kmAtualForm.trim() !== '' ? Number(kmAtualForm) : undefined,
      kmFinal: kmFinalForm.trim() !== '' ? Number(kmFinalForm) : undefined,
    });
    // Só limpa depois da resposta: se falhar, o texto digitado continua na tela pra tentar de novo.
    if (ok && edicoes.current === edicoesNoEnvio) {
      setDirty(false);
      if (draftStorageKey) removeDraft(draftStorageKey);
    }
  }

  if (!podeEditar) {
    return (
      <div>
        <h2 style={{ fontSize: 'var(--font-size-md)', margin: 0 }}>Diagnóstico, observações e solução</h2>
        <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <TextBlock label="Diagnóstico" value={diagnostico} />
          <TextBlock label="Observações" value={observacoes} />
          <TextBlock label="Serviço realizado" value={solucao} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
            <TextBlock label="KM na abertura" value={kmAtual !== undefined ? String(kmAtual) : undefined} />
            <TextBlock label="KM na entrega" value={kmFinal !== undefined ? String(kmFinal) : undefined} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 'var(--font-size-md)', margin: 0 }}>Diagnóstico, observações e solução</h2>
      <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {draftPendente && (
          <div role="status" className="draft-banner">
            <span>
              Há um rascunho não salvo de {new Date(draftPendente.savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
            </span>
            <span className="draft-banner-actions">
              <Button size="sm" onClick={restaurarDraft}>Restaurar</Button>
              <Button size="sm" variant="ghost" onClick={descartarDraft}>Descartar</Button>
            </span>
          </div>
        )}
        <EditTextarea label="Diagnóstico" value={diagnosticoForm} onChange={(v) => alterar(setDiagnosticoForm, v)} />
        <EditTextarea label="Observações" value={observacoesForm} onChange={(v) => alterar(setObservacoesForm, v)} />
        <EditTextarea label="Serviço realizado" value={solucaoForm} onChange={(v) => alterar(setSolucaoForm, v)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          <EditNumber label="KM na abertura" value={kmAtualForm} onChange={(v) => alterar(setKmAtualForm, v)} />
          <EditNumber label="KM na entrega" value={kmFinalForm} onChange={(v) => alterar(setKmFinalForm, v)} />
        </div>

        <div>
          <Button size="sm" loading={salvando} disabled={!dirty} onClick={() => void salvar()}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        {label}
      </div>
      <div>
        {value?.trim() ? (
          value
        ) : (
          <span style={{ color: 'var(--color-text-secondary)' }}>Não informado.</span>
        )}
      </div>
    </div>
  );
}

function EditNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '9px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-input)',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

function EditTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toLocaleUpperCase('pt-BR'))}
        rows={2}
        style={{
          width: '100%',
          padding: '9px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-input)',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
    </div>
  );
}
