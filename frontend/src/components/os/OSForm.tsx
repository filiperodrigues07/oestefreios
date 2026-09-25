import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  adicionarProdutoOS,
  adicionarServicoOS,
  alterarStatusOS,
  atualizarOS,
  atualizarProdutoItemOS,
  atualizarServicoItemOS,
  criarOS,
  duplicarOS,
  excluirOS,
  getOS,
  removerProdutoOS,
  removerServicoOS,
} from '../../api/os.api.js';
import { getClienteByCodigo } from '../../api/clientes.api.js';
import { getEquipamentoByCodigo } from '../../api/equipamentos.api.js';
import { OS_PRIORIDADE_OPTIONS } from '../../constants/osStatus.js';
import { handleMutationError } from '../../pwa/offlineErrorToast.js';
import { OfflineQueuedError } from '../../pwa/OfflineQueuedError.js';
import { hasPermission, useAuthStore } from '../../store/authStore.js';
import { draftKey } from '../../utils/drafts.js';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard.js';
import type { ClienteDTO, EquipamentoDTO } from '../../types/cherp.types.js';
import { type OSPrioridade, type OSStatus } from '../../types/os.types.js';
import {
  ActionIcon,
  Button,
  ConfirmDialog,
  ErrorState,
  LinkButton,
  RequiredMark,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  useToast,
} from '../ui/index.js';
import { CurrencyCell } from '../ui/CurrencyCell.js';
import { NavIcon } from '../layout/NavIcon.js';
import { ClienteVeiculoSection } from './ClienteVeiculoSection.js';
import { DiagnosticoSection, type DiagnosticoPatch } from './DiagnosticoSection.js';
import { FinalizarOSButton } from './FinalizarOSButton.js';
import { FotosSection } from './FotosSection.js';
import { OSFormHeader } from './OSFormHeader.js';
import { HistoryTimeline } from './HistoryTimeline.js';
import { ProdutosServicosSection } from './ProdutosServicosSection.js';
import type { ItemGridRow } from './ItemGrid.js';
import styles from './OSForm.module.css';

interface OSFormProps {
  mode: 'create' | 'edit';
  id?: string;
}

type OSTab = 'dados' | 'itens' | 'diagnostico' | 'historico' | 'fotos';
const OS_TABS_VALIDAS: OSTab[] = ['dados', 'itens', 'diagnostico', 'historico', 'fotos'];

/** Tela única de Ordem de Serviço — criação e edição compartilham a mesma estrutura visual. */
export function OSForm({ mode, id }: OSFormProps) {
  return mode === 'create' ? <OSFormCreate /> : <OSFormEdit id={id!} />;
}

/**
 * Criação: cliente → veículo → problema → prioridade → "Criar OS" grava de verdade no CHERP.
 * Produtos/serviços/diagnóstico só ficam disponíveis depois — não existe OS "rascunho" local.
 */
function OSFormCreate() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [cliente, setCliente] = useState<ClienteDTO | null>(null);
  const [equipamento, setEquipamento] = useState<EquipamentoDTO | null>(null);
  const [problema, setProblema] = useState('');
  const [prioridade, setPrioridade] = useState<OSPrioridade>('NORMAL');
  const guard = useUnsavedChangesGuard(Boolean(cliente || equipamento || problema.trim()));

  const mutation = useMutation({
    mutationFn: () =>
      criarOS({
        clienteCodigo: cliente!.codigo,
        equipamentoCodigo: equipamento!.codigo,
        problema,
        prioridade,
      }),
    onSuccess: (os) => {
      guard.liberar();
      navigate(`/os/${os.id}`, { replace: true });
    },
    onError: (err) => {
      if (err instanceof OfflineQueuedError) {
        showToast(err.message, 'warning');
        guard.liberar();
        navigate('/os', { replace: true });
      }
    },
  });

  const podeSalvar = cliente && equipamento && !mutation.isPending;

  return (
    <div className={`${styles.page} ${styles.detailPage}`}>
      <PageHeader
        title="Nova OS"
        description="Associe o cliente e o veículo para abrir uma ordem de serviço."
        actions={
          <LinkButton to="/os" variant="secondary">
            <ActionIcon name="back" />
            Voltar
          </LinkButton>
        }
      />

      {/* Mesma casca de abas da tela de edição — as que dependem da OS já existir ficam
          desabilitadas até "Criar OS", pra não parecer uma tela totalmente separada. */}
      <Tabs
        items={[
          { key: 'dados', label: '▣ Dados da OS', mobileLabel: 'Dados' },
          { key: 'itens', label: '▤ Produtos e Serviços', mobileLabel: 'Itens', disabled: true, title: 'Disponível depois de criar a OS' },
          { key: 'diagnostico', label: '▱ Diagnóstico', mobileLabel: 'Diagnóstico', disabled: true, title: 'Disponível depois de criar a OS' },
          { key: 'fotos', label: <><ActionIcon name="photo" /> Fotos</>, mobileLabel: <><ActionIcon name="photo" /> Fotos</>, disabled: true, title: 'Disponível depois de criar a OS' },
          { key: 'historico', label: '◷ Histórico', mobileLabel: 'Histórico', disabled: true, title: 'Disponível depois de criar a OS' },
        ]}
        active="dados"
        onChange={() => {}}
        fullWidth
      >
        <section className={styles.identity}>
          <ClienteVeiculoSection
            mode="create"
            cliente={cliente}
            equipamento={equipamento}
            onClienteChange={setCliente}
            onEquipamentoChange={setEquipamento}
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Problema relatado</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label
                htmlFor="problema"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  marginBottom: 'var(--space-1)',
                }}
              >
                Descrição
              </label>
              <textarea
                id="problema"
                value={problema}
                onChange={(e) => setProblema(e.target.value.toLocaleUpperCase('pt-BR'))}
                rows={3}
                className={styles.textarea}
              />
            </div>

            <Select
              className="os-priority-select"
              data-priority={prioridade}
              label={
                <>
                  Prioridade
                  <RequiredMark />
                </>
              }
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as OSPrioridade)}
              options={OS_PRIORIDADE_OPTIONS}
            />

            {mutation.isError && (
              <p
                role="alert"
                style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}
              >
                {mutation.error instanceof Error ? mutation.error.message : 'Erro ao criar OS.'}
              </p>
            )}

            <div>
              <Button
                disabled={!podeSalvar}
                loading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                <ActionIcon name="add" />
                Criar OS
              </Button>
            </div>
          </div>
        </section>
      </Tabs>
      {guard.dialog}
    </div>
  );
}

/** Edição: OS já é uma linha real no CHERP — toda seção grava/consulta de verdade a partir daqui. */
function OSFormEdit({ id }: { id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabInicial = searchParams.get('tab');
  const [tab, setTab] = useState<OSTab>(
    tabInicial && OS_TABS_VALIDAS.includes(tabInicial as OSTab) ? (tabInicial as OSTab) : 'dados',
  );
  const [diagnosticoDirty, setDiagnosticoDirty] = useState(false);
  const [trocaPendente, setTrocaPendente] = useState<string | null>(null);
  const guard = useUnsavedChangesGuard(diagnosticoDirty);
  const userId = useAuthStore((s) => s.user?.id);

  function aplicarTroca(key: string) {
    setTab(key as OSTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', key);
        return next;
      },
      { replace: true },
    );
  }

  function mudarTab(key: string) {
    if (tab === 'diagnostico' && diagnosticoDirty && key !== 'diagnostico') {
      setTrocaPendente(key);
      return;
    }
    aplicarTroca(key);
  }

  const {
    data: os,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['os', id],
    queryFn: () => getOS(id),
    // Sincroniza sozinho com o CHERP enquanto a tela fica aberta (ex.: faturamento fecha o
    // pedido por lá) — seguro contra perder digitação porque cada seção com campo de texto
    // livre (ver DiagnosticoSection) só resincroniza do servidor quando não há edição pendente.
    refetchInterval: 30_000,
  });

  const { data: cliente } = useQuery({
    queryKey: ['cliente', os?.clienteCodigo],
    queryFn: () => getClienteByCodigo(os!.clienteCodigo),
    enabled: !!os,
  });

  const { data: equipamento } = useQuery({
    queryKey: ['equipamento', os?.equipamentoCodigo],
    queryFn: () => getEquipamentoByCodigo(os!.equipamentoCodigo),
    enabled: !!os,
  });

  const [removendo, setRemovendo] = useState<{
    tipo: 'produto' | 'servico';
    codigo: string;
    descricao: string;
  } | null>(null);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['os', id] }),
      queryClient.invalidateQueries({ queryKey: ['os-list'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-operacional'] }),
    ]);
  }

  const salvarMutation = useMutation({
    mutationFn: (patch: DiagnosticoPatch) => atualizarOS(id, patch),
    onSuccess: async () => {
      await invalidate();
      showToast('Alterações salvas.', 'success');
    },
    onError: (err) =>
      handleMutationError(
        err,
        showToast,
        'Não foi possível salvar as alterações. Tente novamente.',
      ),
  });

  const statusMutation = useMutation({
    mutationFn: (status: OSStatus) => alterarStatusOS(id, status),
    onSuccess: async () => {
      await invalidate();
      showToast('Status alterado.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível alterar o status.'),
  });

  const prioridadeMutation = useMutation({
    mutationFn: (prioridade: OSPrioridade) => atualizarOS(id, { prioridade }),
    onSuccess: async () => {
      await invalidate();
      showToast('Prioridade atualizada.', 'success');
    },
    onError: (err) =>
      handleMutationError(err, showToast, 'Não foi possível atualizar a prioridade.'),
  });

  async function adicionarProduto(
    codigo: string,
    quantidade: number,
    precoUnitario?: number,
    descricaoComplementar?: string,
  ) {
    try {
      const atualizado = await adicionarProdutoOS(
        id,
        codigo,
        quantidade,
        precoUnitario,
        descricaoComplementar,
      );
      queryClient.setQueryData(['os', id], atualizado);
      showToast('Produto adicionado.', 'success');
    } catch (err) {
      if (err instanceof OfflineQueuedError) showToast(err.message, 'warning');
      throw err;
    }
  }

  async function adicionarServico(
    codigo: string,
    quantidade: number,
    valorUnitario?: number,
    descricaoComplementar?: string,
  ) {
    try {
      const atualizado = await adicionarServicoOS(
        id,
        codigo,
        quantidade,
        valorUnitario,
        descricaoComplementar,
      );
      queryClient.setQueryData(['os', id], atualizado);
      showToast('Serviço adicionado.', 'success');
    } catch (err) {
      if (err instanceof OfflineQueuedError) showToast(err.message, 'warning');
      throw err;
    }
  }

  async function atualizarProduto(
    codigo: string,
    patch: { quantidade?: number; precoUnitario?: number; descricaoComplementar?: string },
  ) {
    try {
      const atualizado = await atualizarProdutoItemOS(id, codigo, patch);
      queryClient.setQueryData(['os', id], atualizado);
      showToast('Produto atualizado.', 'success');
    } catch (err) {
      if (err instanceof OfflineQueuedError) showToast(err.message, 'warning');
      throw err;
    }
  }

  async function atualizarServico(
    codigo: string,
    patch: { quantidade?: number; precoUnitario?: number; descricaoComplementar?: string },
  ) {
    try {
      const atualizado = await atualizarServicoItemOS(id, codigo, patch);
      queryClient.setQueryData(['os', id], atualizado);
      showToast('Serviço atualizado.', 'success');
    } catch (err) {
      if (err instanceof OfflineQueuedError) showToast(err.message, 'warning');
      throw err;
    }
  }

  const removerMutation = useMutation({
    mutationFn: () =>
      removendo!.tipo === 'produto'
        ? removerProdutoOS(id, removendo!.codigo)
        : removerServicoOS(id, removendo!.codigo),
    onSuccess: async () => {
      await invalidate();
      setRemovendo(null);
      showToast('Removido.', 'success');
    },
    onError: (err) =>
      handleMutationError(err, showToast, 'Não foi possível remover. Tente novamente.'),
  });

  const duplicarMutation = useMutation({
    mutationFn: () => duplicarOS(id),
    onSuccess: async (nova) => {
      await queryClient.invalidateQueries({ queryKey: ['os-list'] });
      showToast(`OS duplicada como #${nova.numero}.`, 'success');
      navigate(`/os/${nova.id}`);
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível duplicar a OS. Tente novamente.'),
  });

  const excluirMutation = useMutation({
    mutationFn: (motivo: string) => excluirOS(id, motivo),
    onSuccess: async () => {
      // A OS deixou de existir — remove do cache em vez de invalidar (refetch daria 404).
      queryClient.removeQueries({ queryKey: ['os', id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['os-list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-operacional'] }),
      ]);
      showToast('OS excluída.', 'success');
      guard.liberar();
      navigate('/os', { replace: true });
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível excluir a OS. Tente novamente.'),
  });

  if (isLoading) {
    return (
      <div className={`${styles.page} ${styles.detailPage}`}>
        <Skeleton height={32} width={240} />
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Skeleton height={120} />
        </div>
      </div>
    );
  }

  if (isError || !os) {
    return (
      <div className={styles.page}>
        <ErrorState
          error={error ?? { status: 404 }}
          action={<Button onClick={() => refetch()}>Tentar novamente</Button>}
        />
      </div>
    );
  }

  // OS com pedido/NF gerado, fechada no CHERP ou finalizada por aqui (travadoLocal): backend já rejeita
  // qualquer mutação (assertNaoFinalizada em os.service.ts) — aqui é só pra não oferecer um controle que
  // vai dar erro ao salvar. Situação de atendimento (PRONTA) sozinha não trava mais nada.
  const osFinalizada =
    (os.situacaoDocumento !== undefined && os.situacaoDocumento !== 0) ||
    Boolean(os.dataConclusao) ||
    Boolean(os.travadoLocal);
  const podeEditar = hasPermission('OS_EDIT') && !osFinalizada;
  const podeAddProduto = hasPermission('PRODUCT_ADD_TO_OS') && !osFinalizada;
  const podeAddServico = hasPermission('SERVICE_ADD_TO_OS') && !osFinalizada;
  const podeMudarStatus = hasPermission('OS_CHANGE_STATUS');
  const mostrarPreco = hasPermission('FINANCIAL_VIEW');
  const podeEditarPreco = hasPermission('FINANCIAL_EDIT');
  const totalItens = os.produtos.length + os.servicos.length;
  const nomeCliente = cliente?.nome ?? os.clienteCodigo;
  const descricaoVeiculo = equipamento?.descricao ?? os.equipamentoCodigo;

  return (
    <div className={`${styles.page} ${styles.detailPage}`} data-pull-refresh-blocked={diagnosticoDirty}>
      <OSFormHeader
        id={id}
        numero={os.numero}
        nroDav={os.nroDav}
        status={os.status}
        prioridade={os.prioridade}
        dataAbertura={os.dataAbertura}
        onRefresh={() => refetch()}
        refreshing={isFetching}
        canChangeStatus={podeMudarStatus && !osFinalizada}
        canEdit={podeEditar}
        onStatusChange={(status) => statusMutation.mutate(status)}
        onPriorityChange={(prioridade) => prioridadeMutation.mutate(prioridade)}
        onFinalizar={() => statusMutation.mutate('CONCLUIDA')}
        finalizando={statusMutation.isPending}
        updating={statusMutation.isPending || prioridadeMutation.isPending}
        canDuplicate={hasPermission('OS_CREATE')}
        onDuplicar={() => duplicarMutation.mutate()}
        duplicando={duplicarMutation.isPending}
        canDelete={hasPermission('OS_DELETE') && !osFinalizada}
        onExcluir={(motivo) => excluirMutation.mutate(motivo)}
        excluindo={excluirMutation.isPending}
      />

      {/* Resumo fixo — some quem é o cliente/veículo mesmo fora da aba "Dados". */}
      <div className={styles.contextBar}>
        <span><small>Cliente</small><strong>{nomeCliente}</strong></span>
        <span><small>Veículo</small><strong>{descricaoVeiculo}</strong></span>
      </div>

      <Tabs
        items={[
          { key: 'dados', label: '▣ Dados da OS', mobileLabel: 'Dados' },
          {
            key: 'itens',
            label:
              totalItens > 0 ? `▤ Produtos e Serviços (${totalItens})` : '▤ Produtos e Serviços',
            mobileLabel: totalItens > 0 ? `Itens (${totalItens})` : 'Itens',
          },
          { key: 'diagnostico', label: '▱ Diagnóstico', mobileLabel: 'Diagnóstico' },
          { key: 'fotos', label: <><ActionIcon name="photo" /> Fotos</>, mobileLabel: <><ActionIcon name="photo" /> Fotos</> },
          { key: 'historico', label: '◷ Histórico', mobileLabel: 'Histórico' },
        ]}
        active={tab}
        onChange={mudarTab}
        fullWidth
      >
        {tab === 'dados' && (
          <>
            <ClienteVeiculoSection
              mode="edit"
              clienteCodigo={os.clienteCodigo}
              clienteNome={nomeCliente}
              veiculoDescricao={descricaoVeiculo}
            />
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Problema relatado</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{os.problema || 'Não informado.'}</p>
            </section>
          </>
        )}

        {tab === 'diagnostico' && (
          <section className={styles.section}>
            <DiagnosticoSection
              diagnostico={os.diagnostico}
              observacoes={os.observacoes}
              solucao={os.solucao}
              kmAtual={os.kmAtual}
              kmFinal={os.kmFinal}
              podeEditar={podeEditar}
              salvando={salvarMutation.isPending}
              onSave={(patch) =>
                salvarMutation.mutateAsync(patch).then(
                  () => true,
                  // Enfileirada offline conta como aceita (sincroniza depois); outro erro mantém o texto na tela.
                  (err: unknown) => err instanceof OfflineQueuedError,
                )
              }
              onDirtyChange={setDiagnosticoDirty}
              draftStorageKey={userId ? draftKey(userId, 'os', id, 'diagnostico') : undefined}
            />
          </section>
        )}

        {tab === 'itens' && (
          <>
            <section className={`${styles.section} ${styles.itemsSection}`}>
              <ProdutosServicosSection
                produtos={os.produtos}
                servicos={os.servicos}
                faturamento={os.faturamento}
                podeAddProduto={podeAddProduto}
                podeAddServico={podeAddServico}
                mostrarPreco={mostrarPreco}
                podeEditarPreco={podeEditarPreco}
                onAdicionarProduto={adicionarProduto}
                onAdicionarServico={adicionarServico}
                onAtualizarProduto={atualizarProduto}
                onAtualizarServico={atualizarServico}
                onRemoverProduto={(row: ItemGridRow) =>
                  setRemovendo({ tipo: 'produto', codigo: row.codigo, descricao: row.descricao })
                }
                onRemoverServico={(row: ItemGridRow) =>
                  setRemovendo({ tipo: 'servico', codigo: row.codigo, descricao: row.descricao })
                }
              />
            </section>

            {mostrarPreco && (
              <section className={styles.financialSummary}>
                <div className={styles.summaryHeading}>
                  <span className={styles.summaryIcon}><NavIcon name="chart" /></span>
                  <div>
                    <h2>Resumo financeiro</h2>
                    <p>Totais calculados no Firebird pelos itens ativos.</p>
                  </div>
                </div>
                <div className={styles.summaryMetrics}>
                  <div className={styles.summaryMetric}>
                    <span>Total produtos</span>
                    <strong><CurrencyCell amount={os.produtos.reduce((total, item) => total + (item.total ?? 0), 0).toFixed(2)} /></strong>
                  </div>
                  <div className={styles.summaryMetric}>
                    <span>Total serviços</span>
                    <strong><CurrencyCell amount={os.servicos.reduce((total, item) => total + (item.total ?? 0), 0).toFixed(2)} /></strong>
                  </div>
                  <div className={`${styles.summaryMetric} ${styles.summaryTotal}`}>
                    <span>Total geral</span>
                    <strong><CurrencyCell amount={(os.faturamento ?? 0).toFixed(2)} /></strong>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {tab === 'historico' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Histórico</h2>
            <HistoryTimeline entries={os.historico} />
          </section>
        )}

        {tab === 'fotos' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Fotos</h2>
            <FotosSection id={id} podeEditar={podeEditar} />
          </section>
        )}
      </Tabs>

      <ConfirmDialog
        open={removendo !== null}
        title={`Remover ${removendo?.tipo === 'produto' ? 'produto' : 'serviço'}?`}
        description={`Esta ação removerá "${removendo?.descricao}" da OS.`}
        confirmLabel="Remover"
        danger
        loading={removerMutation.isPending}
        onCancel={() => setRemovendo(null)}
        onConfirm={() => removerMutation.mutate()}
      />

      <ConfirmDialog
        open={trocaPendente !== null}
        title="Descartar alterações não salvas?"
        description="Há alterações no Diagnóstico que ainda não foram salvas. Trocar de aba agora descarta o que foi digitado."
        confirmLabel="Descartar e trocar"
        danger
        onCancel={() => setTrocaPendente(null)}
        onConfirm={() => {
          const key = trocaPendente!;
          setTrocaPendente(null);
          setDiagnosticoDirty(false);
          aplicarTroca(key);
        }}
      />
      {guard.dialog}
    </div>
  );
}
