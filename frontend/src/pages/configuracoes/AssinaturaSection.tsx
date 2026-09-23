import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { addPagamento, getBilling, removePagamento, updateBilling } from '../../api/billing.api.js';
import { Badge, Button, Card, ConfirmDialog, ErrorState, Input, Modal, Select, Skeleton, useToast, type BadgeTone } from '../../components/ui/index.js';
import type { BillingDTO, BillingUpdateInput, EstadoAssinatura, NovoPagamentoInput } from '../../types/billing.types.js';
import styles from './AssinaturaSection.module.css';

const ESTADO_LABEL: Record<EstadoAssinatura, string> = {
  EM_DIA: 'Em dia',
  A_VENCER: 'A vencer',
  VENCIDA: 'Vencida (carência)',
  SOMENTE_LEITURA: 'Somente leitura',
};
const ESTADO_TONE: Record<EstadoAssinatura, BadgeTone> = { EM_DIA: 'success', A_VENCER: 'warning', VENCIDA: 'danger', SOMENTE_LEITURA: 'danger' };
const FORMAS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'OUTRO', label: 'Outro' },
];

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function dataBr(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function hojeLocal(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

function descricaoDias(dias: number | null): string {
  if (dias === null) return 'Vencimento não configurado.';
  if (dias === 0) return 'Vence hoje.';
  return dias > 0 ? `Faltam ${dias} dia(s).` : `Atrasada há ${Math.abs(dias)} dia(s).`;
}

function PagamentoModal({ billing, onClose }: { billing: BillingDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState<NovoPagamentoInput>({
    data: hojeLocal(),
    referencia: (billing.vencimentoAtual ?? hojeLocal()).slice(0, 7),
    valor: billing.valorMensal,
    forma: 'PIX',
    observacao: '',
  });
  const mutation = useMutation({
    mutationFn: addPagamento,
    onSuccess: () => {
      showToast('Pagamento registrado. Vencimento avançado.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-status'] });
      onClose();
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível registrar.', 'danger'),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(form);
  }
  return <Modal open title="Registrar pagamento" onClose={onClose} footer={<>
    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
    <Button type="submit" form="form-pagamento" loading={mutation.isPending}>Registrar</Button>
  </>}>
    <form id="form-pagamento" onSubmit={submit} className={styles.form}>
      <Input label="Data do pagamento" type="date" required value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
      <Input label="Mês de referência" type="month" required value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} />
      <Input label="Valor (R$)" type="number" step="0.01" min="0" required value={form.valor} onChange={e => setForm({ ...form, valor: Number(e.target.value) })} />
      <Select label="Forma" options={FORMAS} value={form.forma} onChange={e => setForm({ ...form, forma: e.target.value as NovoPagamentoInput['forma'] })} />
      <Input label="Observação (comprovante, etc.)" maxLength={300} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
      <p className={styles.hint}>O vencimento avança 1 mês a partir de {dataBr(billing.vencimentoAtual)}.</p>
    </form>
  </Modal>;
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
  });
  const mutation = useMutation({
    mutationFn: updateBilling,
    onSuccess: () => {
      showToast('Dados da assinatura salvos.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['billing-status'] });
      onClose();
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'danger'),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(form);
  }
  return <Modal open title="Dados da assinatura" onClose={onClose} footer={<>
    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
    <Button type="submit" form="form-assinatura" loading={mutation.isPending}>Salvar</Button>
  </>}>
    <form id="form-assinatura" onSubmit={submit} className={styles.form}>
      <Input label="Cliente" maxLength={120} value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
      <Input label="Plano" maxLength={80} value={form.plano} onChange={e => setForm({ ...form, plano: e.target.value })} />
      <Input label="Valor mensal (R$)" type="number" step="0.01" min="0" required value={form.valorMensal} onChange={e => setForm({ ...form, valorMensal: Number(e.target.value) })} />
      <Input label="Próximo vencimento" type="date" value={form.vencimentoAtual ?? ''} onChange={e => setForm({ ...form, vencimentoAtual: e.target.value || null })} />
      <Input label="Dia do vencimento (1 a 31)" type="number" min="1" max="31" required value={form.diaVencimento} onChange={e => setForm({ ...form, diaVencimento: Number(e.target.value) })} />
      <Input label="Carência após vencer (dias)" type="number" min="0" max="60" required value={form.carenciaDias} onChange={e => setForm({ ...form, carenciaDias: Number(e.target.value) })} />
      <Input label="Avisar antes (dias)" type="number" min="0" max="60" required value={form.avisoDias} onChange={e => setForm({ ...form, avisoDias: Number(e.target.value) })} />
      <p className={styles.hint}>Sem vencimento, o sistema nunca bloqueia. Passada a carência, o sistema fica somente para consulta (você continua com acesso total).</p>
    </form>
  </Modal>;
}

export function AssinaturaSection() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [modal, setModal] = useState<'pagamento' | 'editar' | null>(null);
  const [remover, setRemover] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['billing'], queryFn: getBilling });
  const removeMutation = useMutation({
    mutationFn: removePagamento,
    onSuccess: () => {
      setRemover(null);
      showToast('Pagamento removido do histórico.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível remover.', 'danger'),
  });

  return <section className={styles.section} aria-label="Assinatura">
    <div className={styles.head}>
      <div>
        <h2>Assinatura</h2>
        <p>Mensalidade do cliente. Só administradores veem esta área.</p>
      </div>
      {data && <div className={styles.headActions}>
        <Button variant="secondary" size="sm" onClick={() => setModal('editar')}>Editar dados</Button>
        <Button size="sm" onClick={() => setModal('pagamento')}>Registrar pagamento</Button>
      </div>}
    </div>
    {isLoading && <Skeleton height={100} />}
    {isError && <ErrorState error={error} />}
    {data && <>
      <Card elevated className={styles.summary}>
        <div><span className={styles.label}>Situação</span><Badge tone={ESTADO_TONE[data.estado]}>{ESTADO_LABEL[data.estado]}</Badge><small>{descricaoDias(data.diasParaVencer)}</small></div>
        <div><span className={styles.label}>Próximo vencimento</span><strong>{dataBr(data.vencimentoAtual)}</strong></div>
        <div><span className={styles.label}>Valor mensal</span><strong>{moeda(data.valorMensal)}</strong></div>
        <div><span className={styles.label}>Plano</span><strong>{data.plano || '—'}</strong><small>{data.cliente}</small></div>
      </Card>
      <Card elevated className={styles.history}>
        <h3>Histórico de pagamentos</h3>
        {data.pagamentos.length === 0
          ? <p className={styles.hint}>Nenhum pagamento registrado.</p>
          : <ul className={styles.payList}>{data.pagamentos.map(item => <li key={item.id}>
            <div>
              <strong>{moeda(item.valor)}</strong> · ref. {item.referencia.split('-').reverse().join('/')} · {item.forma}
              <small>Pago em {dataBr(item.data)} · registrado por {item.registradoPor}{item.observacao ? ` · ${item.observacao}` : ''}</small>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setRemover(item.id)}>Remover</Button>
          </li>)}</ul>}
      </Card>
    </>}
    {modal === 'pagamento' && data && <PagamentoModal billing={data} onClose={() => setModal(null)} />}
    {modal === 'editar' && data && <EditarModal billing={data} onClose={() => setModal(null)} />}
    <ConfirmDialog open={remover !== null} title="Remover pagamento" danger
      description="Remove só do histórico. O vencimento não muda — ajuste em Editar dados se precisar."
      confirmLabel="Remover" loading={removeMutation.isPending}
      onConfirm={() => remover && removeMutation.mutate(remover)} onCancel={() => setRemover(null)} />
  </section>;
}
