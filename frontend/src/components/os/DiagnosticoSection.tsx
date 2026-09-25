import { useEffect, useId, useRef, useState } from 'react';
import { readDraft, removeDraft, writeDraft } from '../../utils/drafts.js';
import { somenteDigitos } from '../../utils/veiculoFormatters.js';
import { Button, Modal } from '../ui/index.js';
import styles from './DiagnosticoSection.module.css';

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
  base?: DiagnosticoBase;
}

/** Valores do servidor no momento em que a edição começou (concorrência otimista, ver os.service.ts). */
export interface DiagnosticoBase {
  diagnostico: string;
  observacoes: string;
  solucao: string;
  kmAtual: number | null;
  kmFinal: number | null;
}

/** ok = gravado · queued = na fila offline · conflict = outro usuário alterou antes · error = falhou. */
export type DiagnosticoSaveResult = 'ok' | 'queued' | 'conflict' | 'error';

interface DiagnosticoSectionProps {
  diagnostico?: string;
  observacoes?: string;
  solucao?: string;
  kmAtual?: number;
  kmFinal?: number;
  podeEditar: boolean;
  salvando: boolean;
  /** Só `ok`/`queued` limpam o estado "alterado"; `conflict` abre a escolha entre manter o meu ou o do outro. */
  onSave: (patch: DiagnosticoPatch) => Promise<DiagnosticoSaveResult>;
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

  const baseAtualDoServidor = (): DiagnosticoBase => ({
    diagnostico: diagnostico ?? '',
    observacoes: observacoes ?? '',
    solucao: solucao ?? '',
    kmAtual: kmAtual ?? null,
    kmFinal: kmFinal ?? null,
  });
  // O que estava gravado quando a edição começou — só avança enquanto não há edição local.
  const [base, setBase] = useState<DiagnosticoBase>(baseAtualDoServidor);
  const [conflito, setConflito] = useState(false);

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
    // Restaurar é escolha explícita de sobrepor o que está gravado agora.
    setBase(baseAtualDoServidor());
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
      setBase(baseAtualDoServidor());
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

  async function salvar(sobrescrever = false) {
    const edicoesNoEnvio = edicoes.current;
    const resultado = await onSave({
      diagnostico: diagnosticoForm,
      observacoes: observacoesForm,
      solucao: solucaoForm,
      kmAtual: kmAtualForm.trim() !== '' ? Number(kmAtualForm) : undefined,
      kmFinal: kmFinalForm.trim() !== '' ? Number(kmFinalForm) : undefined,
      base: sobrescrever ? undefined : base,
    });
    if (resultado === 'conflict') {
      setConflito(true);
      return;
    }
    const ok = resultado === 'ok' || resultado === 'queued';
    // Só limpa depois da resposta: se falhar, o texto digitado continua na tela pra tentar de novo.
    if (ok && edicoes.current === edicoesNoEnvio) {
      setDirty(false);
      // Na fila offline o rascunho fica até a próxima abertura confirmar que o servidor recebeu.
      if (draftStorageKey && resultado === 'ok') removeDraft(draftStorageKey);
    }
  }

  function usarVersaoDoOutro() {
    setConflito(false);
    if (draftStorageKey) removeDraft(draftStorageKey);
    setDirty(false);
  }

  if (!podeEditar) {
    return (
      <div>
        <h2 className={styles.title}>Diagnóstico, observações e solução</h2>
        <div className={styles.stackCompact}>
          <TextBlock label="Diagnóstico" value={diagnostico} />
          <TextBlock label="Observações" value={observacoes} />
          <TextBlock label="Serviço realizado" value={solucao} />
          <div className={styles.kmGrid}>
            <TextBlock label="KM na abertura" value={kmAtual !== undefined ? String(kmAtual) : undefined} />
            <TextBlock label="KM na entrega" value={kmFinal !== undefined ? String(kmFinal) : undefined} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className={styles.title}>Diagnóstico, observações e solução</h2>
      <div className={styles.stack}>
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

        <div className={styles.kmGrid}>
          <EditNumber label="KM na abertura" value={kmAtualForm} onChange={(v) => alterar(setKmAtualForm, v)} />
          <EditNumber label="KM na entrega" value={kmFinalForm} onChange={(v) => alterar(setKmFinalForm, v)} />
        </div>
        {kmAtualForm !== '' && kmFinalForm !== '' && Number(kmFinalForm) < Number(kmAtualForm) && (
          // Só avisa (não bloqueia): troca de painel/hodômetro zerado existe na vida real.
          <p role="status" className={styles.kmWarning}>
            KM na entrega menor que na abertura. Confira se não houve erro de digitação.
          </p>
        )}

        <div>
          <Button size="sm" loading={salvando} disabled={!dirty} onClick={() => void salvar()}>
            Salvar
          </Button>
        </div>
      </div>
      {/* Três saídas: fechar (Esc/fora) só volta pra edição — nunca descarta o texto sem escolha explícita. */}
      <Modal
        open={conflito}
        centerOnMobile
        title="Outro usuário alterou esta OS"
        onClose={() => setConflito(false)}
        footer={
          <>
            <Button variant="secondary" onClick={usarVersaoDoOutro}>
              Usar a versão atual
            </Button>
            <Button
              onClick={() => {
                setConflito(false);
                void salvar(true);
              }}
            >
              Gravar a minha versão
            </Button>
          </>
        }
      >
        <p className={styles.conflictText}>
          Enquanto você editava, o diagnóstico foi alterado por outra pessoa (ou direto no CHERP). Seu texto
          continua na tela. Escolha qual versão fica gravada — ou feche para revisar antes.
        </p>
      </Modal>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className={styles.readLabel}>
        {label}
      </div>
      <div className={styles.readValue}>
        {value?.trim() ? (
          value
        ) : (
          <span className={styles.muted}>Não informado.</span>
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
        className={styles.label}
      >
        {label}
      </label>
      <input
        id={id}
        // text + inputMode: teclado numérico sem aceitar "e", "-", "," que o type="number" deixa passar.
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={8}
        enterKeyHint="done"
        value={value}
        onChange={(e) => onChange(somenteDigitos(e.target.value, 8))}
        className={styles.field}
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
        className={styles.label}
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toLocaleUpperCase('pt-BR'))}
        rows={3}
        autoCapitalize="characters"
        className={styles.textarea}
      />
    </div>
  );
}
