import { useState } from 'react';
import { OS_PRIORIDADE_OPTIONS } from '../../constants/osStatus.js';
import type { OSPrioridade } from '../../types/os.types.js';
import type { UserSummaryDTO } from '../../types/user.types.js';
import { Button, Select } from '../ui/index.js';

export interface DiagnosticoPatch {
  diagnostico: string;
  observacoes: string;
  solucao: string;
  prioridade: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  dataPrevista?: string;
  kmAtual?: number;
  kmFinal?: number;
}

interface DiagnosticoSectionProps {
  diagnostico?: string;
  observacoes?: string;
  solucao?: string;
  prioridade: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  dataPrevista?: string;
  nroDav?: string;
  kmAtual?: number;
  kmFinal?: number;
  /** Frete/IPI (ORDEMSERVICO.FRETE/TOTALIPI) — só leitura, financeiro. Omitido sem FINANCIAL_VIEW. */
  frete?: number;
  totalIpi?: number;
  mostrarFinanceiro: boolean;
  podeEditar: boolean;
  /** USER_VIEW — sem ela não dá pra listar/resolver nomes de usuário, só mostra "não atribuído". */
  podeVerUsuarios: boolean;
  usuarios: UserSummaryDTO[];
  salvando: boolean;
  onSave: (patch: DiagnosticoPatch) => void;
}

const NENHUM = '__nenhum__';

/**
 * Diagnóstico / Observações / Serviço realizado (mesmos 3 campos reais do CHERP de hoje —
 * LAUDOTECNICO + OBS com marcador, "Serviço realizado" é só o rótulo na UI pro `solucao` que já
 * existia) + prioridade/responsável/técnico/data prevista, que já existiam no backend (Fase OS-1)
 * mas não tinham controle nenhum na tela.
 */
export function DiagnosticoSection({
  diagnostico,
  observacoes,
  solucao,
  prioridade,
  responsavelId,
  tecnicoId,
  dataPrevista,
  nroDav,
  kmAtual,
  kmFinal,
  frete,
  totalIpi,
  mostrarFinanceiro,
  podeEditar,
  podeVerUsuarios,
  usuarios,
  salvando,
  onSave,
}: DiagnosticoSectionProps) {
  const [editando, setEditando] = useState(false);
  const [diagnosticoForm, setDiagnosticoForm] = useState('');
  const [observacoesForm, setObservacoesForm] = useState('');
  const [solucaoForm, setSolucaoForm] = useState('');
  const [prioridadeForm, setPrioridadeForm] = useState<OSPrioridade>('NORMAL');
  const [responsavelForm, setResponsavelForm] = useState(NENHUM);
  const [tecnicoForm, setTecnicoForm] = useState(NENHUM);
  const [dataPrevistaForm, setDataPrevistaForm] = useState('');
  const [kmAtualForm, setKmAtualForm] = useState('');
  const [kmFinalForm, setKmFinalForm] = useState('');

  function nomeUsuario(id?: string): string {
    if (!id) return 'Não atribuído';
    if (!podeVerUsuarios) return 'Atribuído';
    return usuarios.find((u) => u.id === id)?.name ?? 'Usuário removido';
  }

  function iniciarEdicao() {
    setDiagnosticoForm(diagnostico ?? '');
    setObservacoesForm(observacoes ?? '');
    setSolucaoForm(solucao ?? '');
    setPrioridadeForm(prioridade);
    setResponsavelForm(responsavelId ?? NENHUM);
    setTecnicoForm(tecnicoId ?? NENHUM);
    setDataPrevistaForm(dataPrevista ? dataPrevista.slice(0, 10) : '');
    setKmAtualForm(kmAtual !== undefined ? String(kmAtual) : '');
    setKmFinalForm(kmFinal !== undefined ? String(kmFinal) : '');
    setEditando(true);
  }

  function salvar() {
    onSave({
      diagnostico: diagnosticoForm,
      observacoes: observacoesForm,
      solucao: solucaoForm,
      prioridade: prioridadeForm,
      responsavelId: responsavelForm === NENHUM ? undefined : responsavelForm,
      tecnicoId: tecnicoForm === NENHUM ? undefined : tecnicoForm,
      dataPrevista: dataPrevistaForm ? new Date(dataPrevistaForm).toISOString() : undefined,
      kmAtual: kmAtualForm.trim() !== '' ? Number(kmAtualForm) : undefined,
      kmFinal: kmFinalForm.trim() !== '' ? Number(kmFinalForm) : undefined,
    });
    setEditando(false);
  }

  const usuarioOptions = [{ value: NENHUM, label: 'Não atribuído' }, ...usuarios.map((u) => ({ value: u.id, label: u.name }))];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--font-size-md)', margin: 0 }}>Diagnóstico, observações e solução</h2>
        {podeEditar && !editando && (
          <Button size="sm" variant="secondary" onClick={iniciarEdicao}>
            Editar
          </Button>
        )}
      </div>

      {!editando ? (
        <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <TextBlock label="Diagnóstico" value={diagnostico} />
          <TextBlock label="Observações" value={observacoes} />
          <TextBlock label="Serviço realizado" value={solucao} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
            <TextBlock label="Responsável" value={nomeUsuario(responsavelId)} />
            <TextBlock label="Técnico" value={nomeUsuario(tecnicoId)} />
            <TextBlock
              label="Previsão"
              // Campo é uma data pura (sem hora que importe) — formata sempre como UTC, senão o
              // navegador converte pro fuso local e pode mostrar o dia anterior (Brasil é UTC-3).
              value={dataPrevista ? new Date(dataPrevista).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
            <TextBlock label="Nº DAV" value={nroDav} />
            <TextBlock label="KM na abertura" value={kmAtual !== undefined ? String(kmAtual) : undefined} />
            <TextBlock label="KM na entrega" value={kmFinal !== undefined ? String(kmFinal) : undefined} />
            {mostrarFinanceiro && (
              <>
                <TextBlock label="Frete" value={frete !== undefined ? frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : undefined} />
                <TextBlock label="IPI" value={totalIpi !== undefined ? totalIpi.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : undefined} />
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <EditTextarea label="Diagnóstico" value={diagnosticoForm} onChange={setDiagnosticoForm} />
          <EditTextarea label="Observações" value={observacoesForm} onChange={setObservacoesForm} />
          <EditTextarea label="Serviço realizado" value={solucaoForm} onChange={setSolucaoForm} />

          <Select
            label="Prioridade"
            value={prioridadeForm}
            onChange={(e) => setPrioridadeForm(e.target.value as OSPrioridade)}
            options={OS_PRIORIDADE_OPTIONS}
          />

          {podeVerUsuarios ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
              <Select label="Responsável" value={responsavelForm} onChange={(e) => setResponsavelForm(e.target.value)} options={usuarioOptions} />
              <Select label="Técnico" value={tecnicoForm} onChange={(e) => setTecnicoForm(e.target.value)} options={usuarioOptions} />
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Responsável/técnico: sem permissão pra ver a lista de usuários.
            </p>
          )}

          <div>
            <label
              htmlFor="dataPrevista"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}
            >
              Previsão de entrega
            </label>
            <input
              id="dataPrevista"
              type="date"
              value={dataPrevistaForm}
              onChange={(e) => setDataPrevistaForm(e.target.value)}
              style={{
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
            <EditNumber label="KM na abertura" value={kmAtualForm} onChange={setKmAtualForm} />
            <EditNumber label="KM na entrega" value={kmFinalForm} onChange={setKmFinalForm} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button size="sm" loading={salvando} onClick={salvar}>
              Salvar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</div>
      <div>{value?.trim() ? value : <span style={{ color: 'var(--color-text-secondary)' }}>Não informado.</span>}</div>
    </div>
  );
}

function EditNumber({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{label}</div>
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

function EditTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{label}</div>
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
