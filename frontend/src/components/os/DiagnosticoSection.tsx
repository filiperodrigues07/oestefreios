import { useEffect, useState } from 'react';
import { Button } from '../ui/index.js';

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
  onSave: (patch: DiagnosticoPatch) => void;
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
}: DiagnosticoSectionProps) {
  const [dirty, setDirty] = useState(false);
  const [diagnosticoForm, setDiagnosticoForm] = useState(diagnostico ?? '');
  const [observacoesForm, setObservacoesForm] = useState(observacoes ?? '');
  const [solucaoForm, setSolucaoForm] = useState(solucao ?? '');
  const [kmAtualForm, setKmAtualForm] = useState(kmAtual !== undefined ? String(kmAtual) : '');
  const [kmFinalForm, setKmFinalForm] = useState(kmFinal !== undefined ? String(kmFinal) : '');

  // Ressincroniza com o servidor quando não há edição em andamento — evita perder o que o
  // usuário está digitando se a OS for atualizada em segundo plano (ex. outra aba/refetch).
  useEffect(() => {
    if (dirty) return;
    setDiagnosticoForm(diagnostico ?? '');
    setObservacoesForm(observacoes ?? '');
    setSolucaoForm(solucao ?? '');
    setKmAtualForm(kmAtual !== undefined ? String(kmAtual) : '');
    setKmFinalForm(kmFinal !== undefined ? String(kmFinal) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostico, observacoes, solucao, kmAtual, kmFinal, dirty]);

  function marcarAlterado<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function salvar() {
    onSave({
      diagnostico: diagnosticoForm,
      observacoes: observacoesForm,
      solucao: solucaoForm,
      kmAtual: kmAtualForm.trim() !== '' ? Number(kmAtualForm) : undefined,
      kmFinal: kmFinalForm.trim() !== '' ? Number(kmFinalForm) : undefined,
    });
    setDirty(false);
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
        <EditTextarea label="Diagnóstico" value={diagnosticoForm} onChange={marcarAlterado(setDiagnosticoForm)} />
        <EditTextarea label="Observações" value={observacoesForm} onChange={marcarAlterado(setObservacoesForm)} />
        <EditTextarea label="Serviço realizado" value={solucaoForm} onChange={marcarAlterado(setSolucaoForm)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          <EditNumber label="KM na abertura" value={kmAtualForm} onChange={marcarAlterado(setKmAtualForm)} />
          <EditNumber label="KM na entrega" value={kmFinalForm} onChange={marcarAlterado(setKmFinalForm)} />
        </div>

        <div>
          <Button size="sm" loading={salvando} disabled={!dirty} onClick={salvar}>
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
  return (
    <div>
      <div
        style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}
      >
        {label}
      </div>
      <input
        type="number"
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
          fontSize: 'var(--font-size-md)',
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
  return (
    <div>
      <div
        style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}
      >
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        style={{
          width: '100%',
          padding: '9px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-md)',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
    </div>
  );
}
