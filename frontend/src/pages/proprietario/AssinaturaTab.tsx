import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  addPagamento,
  controlarAssinatura,
  getBilling,
  removePagamento,
  updateBilling,
} from '../../api/billing.api.js';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  useToast,
  type BadgeTone,
} from '../../components/ui/index.js';
import type {
  BillingDTO,
  BillingUpdateInput,
  CobrancaDTO,
  ControleAssinaturaInput,
  EstadoAssinatura,
  ModoAssinatura,
  NovoPagamentoInput,
} from '../../types/billing.types.js';
import { dataBr, hojeLocal, moeda } from './formatos.js';
import styles from './AssinaturaTab.module.css';

export { dataBr, moeda };

export const ESTADO_LABEL: Record<EstadoAssinatura, string> = {
  EM_DIA: 'Em dia',
  A_VENCER: 'A vencer',
  VENCIDA: 'Vencida (carência)',
  SOMENTE_LEITURA: 'Somente leitura',
};
export const ESTADO_TONE: Record<EstadoAssinatura, BadgeTone> = {
  EM_DIA: 'success',
  A_VENCER: 'warning',
  VENCIDA: 'danger',
  SOMENTE_LEITURA: 'danger',
};
const ESTADO_ICONE: Record<EstadoAssinatura, string> = {
  EM_DIA: '✓',
  A_VENCER: '!',
  VENCIDA: '!',
  SOMENTE_LEITURA: '⛔',
};

const FORMAS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'OUTRO', label: 'Outro' },
];

export function descricaoDias(dias: number | null): string {
  if (dias === null) return 'Vencimento não configurado.';
  if (dias === 0) return 'Vence hoje.';
  return dias > 0 ? `Faltam ${dias} dia(s).` : `Atrasada há ${Math.abs(dias)} dia(s).`;
}

const MODO_LABEL: Record<ModoAssinatura, string> = {
  AUTO: 'Automático (pela data)',
  SUSPENSO: 'Suspenso manualmente',
  LIBERADO: 'Liberado manualmente',
};
const MODO_TONE: Record<ModoAssinatura, BadgeTone> = {
  AUTO: 'neutral',
  SUSPENSO: 'danger',
  LIBERADO: 'success',
};

function invalidarBilling(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['billing'] });
  void queryClient.invalidateQueries({ queryKey: ['billing-status'] });
  void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
}

export function PagamentoModal({
  billing,
  cobranca,
  onClose,
}: {
  billing: BillingDTO;
  cobranca?: CobrancaDTO;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState<NovoPagamentoInput>({
    data: hojeLocal(),
    referencia: cobranca?.referencia ?? (billing.vencimentoAtual ?? hojeLocal()).slice(0, 7),
    valor: cobranca?.valor ?? billing.valorMensal,
    forma: cobranca ? 'BOLETO' : 'PIX',
    observacao: '',
    ...(cobranca ? { cobrancaId: cobranca.id } : {}),
  });
  const mutation = useMutation({
    mutationFn: addPagamento,
    onSuccess: () => {
      showToast('Pagamento registrado. Vencimento avançado.', 'success');
      invalidarBilling(queryClient);
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível registrar.', 'danger'),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(form);
  }
  return (
    <Modal
      open
      title={cobranca ? 'Dar baixa no boleto' : 'Registrar pagamento'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-pagamento" loading={mutation.isPending}>
            {cobranca ? 'Confirmar baixa' : 'Registrar'}
          </Button>
        </>
      }
    >
      <form id="form-pagamento" onSubmit={submit} className={styles.form}>
        <Input
          label="Data do pagamento"
          type="date"
          required
          value={form.data}
          onChange={(e) => setForm({ ...form, data: e.target.value })}
        />
        <Input
          label="Mês de referência"
          type="month"
          required
          readOnly={Boolean(cobranca)}
          value={form.referencia}
          onChange={(e) => setForm({ ...form, referencia: e.target.value })}
        />
        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          min="0"
          required
          readOnly={Boolean(cobranca)}
          value={form.valor}
          onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
        />
        <Select
          label="Forma"
          options={FORMAS}
          value={form.forma}
          onChange={(e) =>
            setForm({ ...form, forma: e.target.value as NovoPagamentoInput['forma'] })
          }
        />
        <Input
          label="Observação (comprovante, etc.)"
          maxLength={300}
          value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
        />
        <p className={styles.hint}>
          O vencimento avança 1 mês a partir de {dataBr(billing.vencimentoAtual)}.
        </p>
        {!cobranca && (
          <p className={styles.hint}>
            Este pagamento não dá baixa em um boleto. Para quitar um boleto, use “Dar baixa” em Contas a receber.
          </p>
        )}
      </form>
    </Modal>
  );
}

function EditarModal({ billing, onClose }: { billing: BillingDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState<BillingUpdateInput>({
    cliente: billing.cliente,
    plano: billing.plano,
    valorMensal: billing.valorMensal,
    vencimentoAtual: billing.vencimentoAtual,
    diaVencimento: billing.diaVencimento,
    carenciaDias: billing.carenciaDias,
    avisoDias: billing.avisoDias,
    observacaoInterna: billing.observacaoInterna,
    mensagemCliente: billing.mensagemCliente,
  });
  const mutation = useMutation({
    mutationFn: updateBilling,
    onSuccess: () => {
      showToast('Dados da assinatura salvos.', 'success');
      invalidarBilling(queryClient);
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'danger'),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(form);
  }
  return (
    <Modal
      open
      title="Dados da assinatura"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-assinatura" loading={mutation.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-assinatura" onSubmit={submit} className={styles.form}>
        <Input
          label="Cliente"
          maxLength={120}
          value={form.cliente}
          onChange={(e) => setForm({ ...form, cliente: e.target.value })}
        />
        <Input
          label="Plano"
          maxLength={80}
          value={form.plano}
          onChange={(e) => setForm({ ...form, plano: e.target.value })}
        />
        <Input
          label="Valor mensal (R$)"
          type="number"
          step="0.01"
          min="0"
          required
          value={form.valorMensal}
          onChange={(e) => setForm({ ...form, valorMensal: Number(e.target.value) })}
        />
        <Input
          label="Próximo vencimento"
          type="date"
          value={form.vencimentoAtual ?? ''}
          onChange={(e) => setForm({ ...form, vencimentoAtual: e.target.value || null })}
        />
        <Input
          label="Dia do vencimento (1 a 31)"
          type="number"
          min="1"
          max="31"
          required
          value={form.diaVencimento}
          onChange={(e) => setForm({ ...form, diaVencimento: Number(e.target.value) })}
        />
        <Input
          label="Carência após vencer (dias)"
          type="number"
          min="0"
          max="60"
          required
          value={form.carenciaDias}
          onChange={(e) => setForm({ ...form, carenciaDias: Number(e.target.value) })}
        />
        <Input
          label="Avisar você antes (dias)"
          type="number"
          min="0"
          max="60"
          required
          value={form.avisoDias}
          onChange={(e) => setForm({ ...form, avisoDias: Number(e.target.value) })}
        />
        <Input
          label="Mensagem ao cliente no modo consulta"
          maxLength={300}
          placeholder="Vazio = mensagem padrão"
          value={form.mensagemCliente}
          onChange={(e) => setForm({ ...form, mensagemCliente: e.target.value })}
        />
        <Input
          label="Observação interna (só você vê)"
          maxLength={500}
          value={form.observacaoInterna}
          onChange={(e) => setForm({ ...form, observacaoInterna: e.target.value })}
        />
        <p className={styles.hint}>
          Sem vencimento, o sistema nunca bloqueia. Passada a carência, o sistema fica somente para
          consulta para todos, menos você.
        </p>
      </form>
    </Modal>
  );
}

const CONTROLE_TEXTO: Record<
  ControleAssinaturaInput['acao'],
  { titulo: string; confirmar: string; ajuda: string }
> = {
  SUSPENDER: {
    titulo: 'Suspender agora',
    confirmar: 'Suspender',
    ajuda:
      'O sistema vira somente consulta para todos, menos você, imediatamente — independente da data.',
  },
  LIBERAR: {
    titulo: 'Liberar manualmente',
    confirmar: 'Liberar',
    ajuda:
      'O sistema volta a funcionar mesmo vencido. Com prazo, a liberação expira e volta ao automático sozinha.',
  },
  AUTOMATICO: {
    titulo: 'Voltar ao automático',
    confirmar: 'Voltar ao automático',
    ajuda: 'Remove a suspensão/liberação manual: vale de novo o cálculo pelo vencimento.',
  },
};

function ControleModal({
  acao,
  billing,
  onClose,
}: {
  acao: ControleAssinaturaInput['acao'];
  billing: BillingDTO;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [motivo, setMotivo] = useState('');
  const [liberadoAte, setLiberadoAte] = useState('');
  const [mensagem, setMensagem] = useState(billing.mensagemCliente);
  const texto = CONTROLE_TEXTO[acao];
  const valido = motivo.trim().length >= 5;
  const mutation = useMutation({
    mutationFn: controlarAssinatura,
    onSuccess: () => {
      showToast(
        acao === 'SUSPENDER'
          ? 'Sistema suspenso (somente consulta).'
          : acao === 'LIBERAR'
            ? 'Sistema liberado.'
            : 'Voltou ao automático.',
        'success',
      );
      invalidarBilling(queryClient);
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível aplicar.', 'danger'),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valido) return;
    mutation.mutate({
      acao,
      motivo: motivo.trim(),
      ...(acao === 'LIBERAR' ? { liberadoAte: liberadoAte || null } : {}),
      ...(acao === 'SUSPENDER' ? { mensagemCliente: mensagem.trim() } : {}),
    });
  }
  return (
    <Modal
      open
      title={texto.titulo}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-controle"
            variant={acao === 'SUSPENDER' ? 'danger' : 'primary'}
            loading={mutation.isPending}
            disabled={!valido}
          >
            {texto.confirmar}
          </Button>
        </>
      }
    >
      <form id="form-controle" onSubmit={submit} className={styles.form}>
        <p className={styles.hint}>{texto.ajuda}</p>
        {acao === 'LIBERAR' && (
          <Input
            label="Liberado até (opcional)"
            type="date"
            min={hojeLocal()}
            value={liberadoAte}
            onChange={(e) => setLiberadoAte(e.target.value)}
          />
        )}
        {acao === 'SUSPENDER' && (
          <Input
            label="Mensagem ao cliente (opcional)"
            maxLength={300}
            placeholder="Ex.: Regularize a mensalidade para voltar a salvar."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
          />
        )}
        <Input
          label="Motivo (fica na auditoria)"
          required
          minLength={5}
          maxLength={500}
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          error={motivo.length > 0 && !valido ? 'Informe pelo menos 5 caracteres.' : undefined}
        />
      </form>
    </Modal>
  );
}

type Dialogo =
  | { tipo: 'pagamento'; cobranca?: CobrancaDTO }
  | { tipo: 'editar' }
  | { tipo: 'controle'; acao: ControleAssinaturaInput['acao'] }
  | null;

export function AssinaturaTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [remover, setRemover] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['billing'],
    queryFn: getBilling,
  });

  // Atalhos da Visão geral chegam com ?acao=pagamento|suspender|liberar.
  const acaoDaUrl = searchParams.get('acao');
  const dialogoUrl: Dialogo =
    acaoDaUrl === 'pagamento'
      ? { tipo: 'pagamento' }
      : acaoDaUrl === 'suspender'
        ? { tipo: 'controle', acao: 'SUSPENDER' }
        : acaoDaUrl === 'liberar'
          ? { tipo: 'controle', acao: 'LIBERAR' }
          : null;
  const dialogoAtivo = data ? (dialogo ?? dialogoUrl) : null;

  function fecharDialogo() {
    setDialogo(null);
    if (acaoDaUrl) {
      const proximo = new URLSearchParams(searchParams);
      proximo.delete('acao');
      setSearchParams(proximo, { replace: true });
    }
  }

  const removeMutation = useMutation({
    mutationFn: removePagamento,
    onSuccess: () => {
      setRemover(null);
      showToast('Pagamento removido do histórico.', 'success');
      invalidarBilling(queryClient);
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível remover.', 'danger'),
  });

  return (
    <section className={styles.section} aria-label="Assinatura">
      <div className={styles.head}>
        <div>
          <h2>Assinatura</h2>
          <p>Mensalidade do cliente. Só você vê e altera esta área.</p>
        </div>
        {data && (
          <div className={styles.headActions}>
            <Button variant="secondary" size="sm" onClick={() => setDialogo({ tipo: 'editar' })}>
              Editar dados
            </Button>
            <Button size="sm" onClick={() => setDialogo({ tipo: 'pagamento' })}>
              Pagamento sem boleto
            </Button>
          </div>
        )}
      </div>
      {isLoading && <Skeleton height={100} />}
      {isError && <ErrorState error={error} />}
      {data && (
        <>
          <Card elevated className={styles.summary}>
            <div>
              <span className={styles.label}>Situação</span>
              <Badge tone={ESTADO_TONE[data.estado]}>
                <span aria-hidden="true">{ESTADO_ICONE[data.estado]} </span>
                {ESTADO_LABEL[data.estado]}
              </Badge>
              <small>{descricaoDias(data.diasParaVencer)}</small>
            </div>
            <div>
              <span className={styles.label}>Próximo vencimento</span>
              <strong>{dataBr(data.vencimentoAtual)}</strong>
            </div>
            <div>
              <span className={styles.label}>Valor mensal</span>
              <strong>{moeda(data.valorMensal)}</strong>
            </div>
            <div>
              <span className={styles.label}>Plano</span>
              <strong>{data.plano || '—'}</strong>
              <small>{data.cliente}</small>
            </div>
          </Card>

          <Card elevated className={styles.control}>
            <div className={styles.controlHead}>
              <h3>Controle manual</h3>
              <Badge tone={MODO_TONE[data.modo]} className={styles.modeBadge}>
                {MODO_LABEL[data.modo]}
                {data.modo === 'LIBERADO'
                  ? data.liberadoAte
                    ? ` até ${dataBr(data.liberadoAte)}`
                    : ' (sem prazo)'
                  : ''}
              </Badge>
            </div>
            {data.modo !== 'AUTO' && (
              <p className={styles.meta}>
                Por {data.controlePor || '—'} em{' '}
                {data.controleEm ? new Date(data.controleEm).toLocaleString('pt-BR') : '—'} ·
                motivo: {data.controleMotivo || '—'}
              </p>
            )}
            <div className={styles.preview}>
              <span className={styles.label}>O que o cliente vê agora</span>
              {data.estado === 'SOMENTE_LEITURA' ? (
                <div className={styles.previewBox} role="status">
                  {data.mensagem}
                </div>
              ) : (
                <p className={styles.hint}>Nada — o sistema funciona normalmente para ele.</p>
              )}
            </div>
            <div className={styles.controlActions}>
              {data.modo !== 'SUSPENSO' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDialogo({ tipo: 'controle', acao: 'SUSPENDER' })}
                >
                  Suspender agora
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDialogo({ tipo: 'controle', acao: 'LIBERAR' })}
              >
                {data.modo === 'LIBERADO' ? 'Alterar liberação' : 'Liberar…'}
              </Button>
              {data.modo !== 'AUTO' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogo({ tipo: 'controle', acao: 'AUTOMATICO' })}
                >
                  Voltar ao automático
                </Button>
              )}
            </div>
            {data.observacaoInterna && (
              <p className={styles.meta}>Observação interna: {data.observacaoInterna}</p>
            )}
          </Card>

          <Card elevated className={styles.history}>
            <h3>Histórico de pagamentos</h3>
            {data.pagamentos.length === 0 ? (
              <p className={styles.hint}>Nenhum pagamento registrado.</p>
            ) : (
              <ul className={styles.payList}>
                {data.pagamentos.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{moeda(item.valor)}</strong> · ref.{' '}
                      {item.referencia.split('-').reverse().join('/')} · {item.forma}
                      <small>
                        Pago em {dataBr(item.data)} · registrado por {item.registradoPor}
                        {item.observacao ? ` · ${item.observacao}` : ''}
                      </small>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => setRemover(item.id)}>
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      {dialogoAtivo?.tipo === 'pagamento' && data && (
        <PagamentoModal billing={data} cobranca={dialogoAtivo.cobranca} onClose={fecharDialogo} />
      )}
      {dialogoAtivo?.tipo === 'editar' && data && (
        <EditarModal billing={data} onClose={fecharDialogo} />
      )}
      {dialogoAtivo?.tipo === 'controle' && data && (
        <ControleModal acao={dialogoAtivo.acao} billing={data} onClose={fecharDialogo} />
      )}
      <ConfirmDialog
        open={remover !== null}
        title="Remover pagamento"
        danger
        description="Remove só do histórico. O vencimento não muda — ajuste em Editar dados se precisar."
        confirmLabel="Remover"
        loading={removeMutation.isPending}
        onConfirm={() => remover && removeMutation.mutate(remover)}
        onCancel={() => setRemover(null)}
      />
    </section>
  );
}
