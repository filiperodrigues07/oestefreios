import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  adicionarProdutoOS,
  adicionarServicoOS,
  alterarStatusOS,
  atualizarOS,
  atualizarProdutoItemOS,
  atualizarServicoItemOS,
  criarOS,
  listarOS,
  duplicarOS,
  excluirOS,
  getOS,
  removerProdutoOS,
  removerServicoOS,
  reabrirOS,
  restaurarItemOS,
  trocarVinculoOS,
} from '../../api/os.api.js';
import { getClienteByCodigo } from '../../api/clientes.api.js';
import { ApiError } from '../../api/httpClient.js';
import { getEquipamentoByCodigo } from '../../api/equipamentos.api.js';
import { OS_PRIORIDADE_OPTIONS } from '../../constants/osStatus.js';
import { handleMutationError } from '../../pwa/offlineErrorToast.js';
import { OfflineQueuedError } from '../../pwa/OfflineQueuedError.js';
import { hasPermission, useAuthStore } from '../../store/authStore.js';
import { draftKey, removeDraft } from '../../utils/drafts.js';
import { getErrorPresentation, getUserErrorMessage } from '../../utils/errorPresentation.js';
import { useSomenteLeitura } from '../../hooks/useSomenteLeitura.js';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard.js';
import type { ClienteDTO, EquipamentoDTO } from '../../types/cherp.types.js';
import { type OrdemServicoDTO, type OSPrioridade, type OSStatus } from '../../types/os.types.js';
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
import { OSKmFields, parseKm } from './OSKmFields.js';
import { OSKmSection } from './OSKmSection.js';
import type { OSKmInput } from './OSDuplicateDialog.js';
import { OSVinculoDialog, type OSVinculoInput } from './OSVinculoDialog.js';
import { OSMessageDialog } from './OSMessageDialog.js';
import type { OsMessageChannel } from '../../api/os.api.js';
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

function osTabLabel(icon: 'clipboard' | 'items' | 'diagnosis' | 'photo' | 'history', text: string) {
  return (
    <>
      <ActionIcon name={icon} size={18} /> {text}
    </>
  );
}

function mensagemErroCriacao(error: unknown): string {
  const presentation = getErrorPresentation(error);
  return getUserErrorMessage(error, `${presentation.title}. ${presentation.description}`);
}

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
  const [kmAtual, setKmAtual] = useState('');
  const [kmFinal, setKmFinal] = useState('');
  const guard = useUnsavedChangesGuard(Boolean(cliente || equipamento || problema.trim() || kmAtual || kmFinal));

  // Vindo de "Nova OS" na tela de Veículos (`/os/nova?veiculo=<código>`): já abre com veículo e cliente escolhidos.
  const [searchParams] = useSearchParams();
  const veiculoInicial = searchParams.get('veiculo');
  useEffect(() => {
    if (!veiculoInicial) return;
    let ativo = true;
    void (async () => {
      try {
        const veiculo = await getEquipamentoByCodigo(veiculoInicial);
        const dono = await getClienteByCodigo(veiculo.clienteCodigo);
        if (!ativo) return;
        setEquipamento(veiculo);
        setCliente(dono);
      } catch {
        showToast('Não foi possível carregar o veículo. Escolha a placa manualmente.', 'warning');
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculoInicial]);

  // Última OS do veículo: mostra o KM de referência e avisa se o digitado for menor (erro de digitação comum).
  const { data: ultimaOS } = useQuery({
    queryKey: ['ultima-os-veiculo', equipamento?.codigo],
    queryFn: async () => {
      const resultado = await listarOS({ busca: equipamento!.identificacao || equipamento!.codigo, incluirFinalizadas: true, limit: 5 });
      return resultado.items.find((os) => os.equipamentoCodigo === equipamento!.codigo) ?? null;
    },
    enabled: !!equipamento,
    staleTime: 60_000,
  });
  const kmUltimaOS = ultimaOS?.kmFinal ?? ultimaOS?.kmAtual;
  const kmDigitado = parseKm(kmAtual);

  const mutation = useMutation({
    mutationFn: () =>
      criarOS({
        clienteCodigo: cliente!.codigo,
        equipamentoCodigo: equipamento!.codigo,
        problema,
        prioridade,
        kmAtual: parseKm(kmAtual)!,
        kmFinal: parseKm(kmFinal)!,
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

  const somenteLeitura = useSomenteLeitura();
  const podeSalvar = !somenteLeitura && cliente && equipamento && parseKm(kmAtual) !== undefined && parseKm(kmFinal) !== undefined && !mutation.isPending;
  const faltando = [
    !equipamento && 'veículo',
    !cliente && 'cliente',
    parseKm(kmAtual) === undefined && 'KM inicial',
    parseKm(kmFinal) === undefined && 'KM final',
  ].filter(Boolean) as string[];
  const erroCriacao = mutation.isError ? mensagemErroCriacao(mutation.error) : null;

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
          {
            key: 'dados',
            label: osTabLabel('clipboard', 'Dados da OS'),
            mobileLabel: osTabLabel('clipboard', 'Dados'),
          },
          {
            key: 'itens',
            label: osTabLabel('items', 'Produtos e Serviços'),
            mobileLabel: osTabLabel('items', 'Itens'),
            disabled: true,
            title: 'Disponível depois de criar a OS',
          },
          {
            key: 'diagnostico',
            label: osTabLabel('diagnosis', 'Diagnóstico'),
            mobileLabel: osTabLabel('diagnosis', 'Diagnóstico'),
            disabled: true,
            title: 'Disponível depois de criar a OS',
          },
          {
            key: 'fotos',
            label: osTabLabel('photo', 'Fotos'),
            mobileLabel: osTabLabel('photo', 'Fotos'),
            disabled: true,
            title: 'Disponível depois de criar a OS',
          },
          {
            key: 'historico',
            label: osTabLabel('history', 'Histórico'),
            mobileLabel: osTabLabel('history', 'Histórico'),
            disabled: true,
            title: 'Disponível depois de criar a OS',
          },
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
          <div className={styles.createStack}>
            <div>
              <label htmlFor="problema" className={styles.fieldLabel}>
                Descrição
              </label>
              <textarea
                id="problema"
                value={problema}
                onChange={(e) => setProblema(e.target.value.toLocaleUpperCase('pt-BR'))}
                autoCapitalize="characters"
                rows={3}
                className={styles.textarea}
              />
            </div>

            <OSKmFields kmAtual={kmAtual} kmFinal={kmFinal} onKmAtualChange={setKmAtual} onKmFinalChange={setKmFinal} />
            {ultimaOS && kmUltimaOS !== undefined && (
              <p className={styles.faltando}>
                Última OS deste veículo: #{ultimaOS.numero} em {new Date(ultimaOS.dataAbertura).toLocaleDateString('pt-BR')}, {kmUltimaOS.toLocaleString('pt-BR')} km.
                {kmDigitado !== undefined && kmDigitado < kmUltimaOS && ' O KM inicial digitado é menor — confira.'}
              </p>
            )}

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
              <p role="alert" className={styles.formError}>
                {erroCriacao}
              </p>
            )}

            {/* No celular a barra fica colada no rodapé da tela (perto do polegar) e diz o que falta. */}
            <div className={styles.createActions}>
              {somenteLeitura && <p className={styles.faltando}>Sistema em modo consulta: não é possível criar OS agora. Fale com o suporte.</p>}
              {!somenteLeitura && faltando.length > 0 && <p className={styles.faltando}>Falta: {faltando.join(', ')}</p>}
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
  const [messageChannel, setMessageChannel] = useState<OsMessageChannel | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabInicial = searchParams.get('tab');
  const [tab, setTab] = useState<OSTab>(
    tabInicial && OS_TABS_VALIDAS.includes(tabInicial as OSTab) ? (tabInicial as OSTab) : 'dados',
  );
  const [diagnosticoDirty, setDiagnosticoDirty] = useState(false);
  const [kmDirty, setKmDirty] = useState(false);
  const [trocaPendente, setTrocaPendente] = useState<string | null>(null);
  const guard = useUnsavedChangesGuard(diagnosticoDirty || kmDirty);
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
    if (((tab === 'diagnostico' && diagnosticoDirty) || (tab === 'dados' && kmDirty)) && key !== tab) {
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
    refetchInterval: 60_000,
  });

  const { data: cliente } = useQuery({
    queryKey: ['cliente', os?.clienteCodigo],
    queryFn: () => getClienteByCodigo(os!.clienteCodigo),
    enabled: !!os,
    staleTime: 5 * 60_000, // cadastro quase nunca muda durante a edição da OS
  });

  const { data: equipamento } = useQuery({
    queryKey: ['equipamento', os?.equipamentoCodigo],
    queryFn: () => getEquipamentoByCodigo(os!.equipamentoCodigo),
    enabled: !!os,
    staleTime: 5 * 60_000,
  });

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['os', id] }),
      queryClient.invalidateQueries({ queryKey: ['os-list'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-operacional'] }),
    ]);
  }

  const kmMutation = useMutation({
    mutationFn: (patch: { kmAtual: number; kmFinal: number; base?: { kmAtual: number | null; kmFinal: number | null } }) => atualizarOS(id, patch),
    onSuccess: async () => { await invalidate(); showToast('KM salvos.', 'success'); },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'OS_CONFLICT') return;
      handleMutationError(err, showToast, 'Não foi possível salvar os KM. Tente novamente.');
    },
  });

  const salvarMutation = useMutation({
    mutationFn: (patch: DiagnosticoPatch) => atualizarOS(id, patch),
    onSuccess: async () => {
      await invalidate();
      showToast('Alterações salvas.', 'success');
    },
    onError: (err) => {
      // Conflito tem diálogo próprio no DiagnosticoSection — toast aqui seria aviso duplicado.
      if (err instanceof ApiError && err.code === 'OS_CONFLICT') return;
      handleMutationError(
        err,
        showToast,
        'Não foi possível salvar as alterações. Tente novamente.',
      );
    },
  });

  /**
   * Atualização otimista: o seletor muda na hora; se o backend recusar (transição inválida, sem
   * conexão de verdade...), volta ao valor anterior. Enfileirado offline mantém o novo valor na tela.
   */
  async function aplicarOtimista(patch: Partial<OrdemServicoDTO>) {
    await queryClient.cancelQueries({ queryKey: ['os', id] });
    const anterior = queryClient.getQueryData<OrdemServicoDTO>(['os', id]);
    if (anterior) queryClient.setQueryData<OrdemServicoDTO>(['os', id], { ...anterior, ...patch });
    return { anterior };
  }

  function desfazerOtimista(err: unknown, contexto: { anterior?: OrdemServicoDTO } | undefined) {
    if (err instanceof OfflineQueuedError) return;
    if (contexto?.anterior) queryClient.setQueryData(['os', id], contexto.anterior);
  }

  const statusMutation = useMutation({
    mutationFn: (status: OSStatus) => alterarStatusOS(id, status),
    onMutate: (status) => aplicarOtimista({ status }),
    onSuccess: async (_os, status) => {
      await invalidate();
      // Quem não vê finalizadas: a OS sai da lista dele — volta pra lista em vez de ficar numa OS travada.
      if (
        (status === 'CONCLUIDA' || status === 'CANCELADA') &&
        !hasPermission('OS_VIEW_FINALIZADAS')
      ) {
        showToast(
          `OS ${status === 'CONCLUIDA' ? 'finalizada' : 'cancelada'}. Ela saiu da sua lista.`,
          'success',
        );
        guard.liberar();
        navigate('/os', { replace: true });
        return;
      }
      showToast('Status alterado.', 'success');
    },
    onError: (err, _status, contexto) => {
      desfazerOtimista(err, contexto);
      handleMutationError(err, showToast, 'Não foi possível alterar o status.');
    },
  });

  const prioridadeMutation = useMutation({
    mutationFn: (prioridade: OSPrioridade) => atualizarOS(id, { prioridade }),
    onMutate: (prioridade) => aplicarOtimista({ prioridade }),
    onSuccess: async () => {
      await invalidate();
      showToast('Prioridade atualizada.', 'success');
    },
    onError: (err, _prioridade, contexto) => {
      desfazerOtimista(err, contexto);
      handleMutationError(err, showToast, 'Não foi possível atualizar a prioridade.');
    },
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
    itemId?: number,
  ) {
    try {
      const atualizado = await atualizarProdutoItemOS(id, codigo, patch, itemId);
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
    itemId?: number,
  ) {
    try {
      const atualizado = await atualizarServicoItemOS(id, codigo, patch, itemId);
      queryClient.setQueryData(['os', id], atualizado);
      showToast('Serviço atualizado.', 'success');
    } catch (err) {
      if (err instanceof OfflineQueuedError) showToast(err.message, 'warning');
      throw err;
    }
  }

  // Sem diálogo de confirmação: remove na hora e oferece "Desfazer" — confirmação o usuário clica sem ler,
  // desfazer corrige o erro de verdade.
  const restaurarMutation = useMutation({
    mutationFn: (item: { tipo: 'produto' | 'servico'; codigo: string; itemId?: number }) =>
      restaurarItemOS(id, item.tipo, item.codigo, item.itemId),
    onSuccess: (atualizado, item) => {
      queryClient.setQueryData(['os', id], atualizado);
      void queryClient.invalidateQueries({ queryKey: ['os-list'] });
      showToast(`${item.tipo === 'produto' ? 'Produto' : 'Serviço'} restaurado.`, 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível desfazer a remoção.'),
  });

  const removerMutation = useMutation({
    mutationFn: (item: {
      tipo: 'produto' | 'servico';
      codigo: string;
      descricao: string;
      itemId?: number;
    }) =>
      item.tipo === 'produto'
        ? removerProdutoOS(id, item.codigo, item.itemId)
        : removerServicoOS(id, item.codigo, item.itemId),
    onSuccess: async (_os, item) => {
      await invalidate();
      showToast(`"${item.descricao}" removido.`, 'success', {
        actionLabel: 'Desfazer',
        onAction: () => restaurarMutation.mutate(item),
      });
    },
    onError: (err) =>
      handleMutationError(err, showToast, 'Não foi possível remover. Tente novamente.'),
  });

  const duplicarMutation = useMutation({
    mutationFn: (km: OSKmInput) => duplicarOS(id, km),
    onSuccess: async (nova) => {
      await queryClient.invalidateQueries({ queryKey: ['os-list'] });
      showToast(`OS duplicada como #${nova.numero}.`, 'success');
      navigate(`/os/${nova.id}`);
    },
    onError: (err) =>
      handleMutationError(err, showToast, 'Não foi possível duplicar a OS. Tente novamente.'),
  });

  const [trocandoVinculo, setTrocandoVinculo] = useState(false);
  const trocarVinculoMutation = useMutation({
    mutationFn: (vinculo: OSVinculoInput) => trocarVinculoOS(id, vinculo),
    onSuccess: async (atualizado) => {
      queryClient.setQueryData(['os', id], atualizado);
      await invalidate();
      setTrocandoVinculo(false);
      showToast('Cliente/veículo da OS atualizados.', 'success');
    },
    onError: (err) =>
      handleMutationError(err, showToast, 'Não foi possível trocar cliente/veículo. Tente novamente.'),
  });

  const reabrirMutation = useMutation({
    mutationFn: (motivo: string) => reabrirOS(id, motivo),
    onSuccess: async (atualizado) => {
      queryClient.setQueryData(['os', id], atualizado);
      await invalidate();
      showToast('OS reaberta. Já pode editar de novo.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível reabrir a OS.'),
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
    onError: (err) =>
      handleMutationError(err, showToast, 'Não foi possível excluir a OS. Tente novamente.'),
  });

  if (isLoading) {
    return (
      <div className={`${styles.page} ${styles.detailPage}`}>
        <Skeleton height={32} width={240} />
        <div className={styles.skeletonGap}>
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
    <div
      className={`${styles.page} ${styles.detailPage}`}
      data-pull-refresh-blocked={diagnosticoDirty || kmDirty}
    >
      <OSFormHeader
        id={id}
        numero={os.numero}
        nroDav={os.nroDav}
        status={os.status}
        situacaoAtendimentoCodigo={os.situacaoAtendimentoCodigo}
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
        onDuplicar={(km) => duplicarMutation.mutate(km)}
        duplicando={duplicarMutation.isPending}
        canDelete={hasPermission('OS_DELETE') && !osFinalizada}
        onExcluir={(motivo) => excluirMutation.mutate(motivo)}
        excluindo={excluirMutation.isPending}
        canReopen={
          hasPermission('OS_REOPEN') &&
          Boolean(os.travadoLocal) &&
          (os.situacaoDocumento ?? 0) === 0
        }
        onReabrir={(motivo) => reabrirMutation.mutate(motivo)}
        reabrindo={reabrirMutation.isPending}
        onEnviar={hasPermission('OS_CHANGE_STATUS') ? setMessageChannel : undefined}
      />

      {/* Resumo fixo — some quem é o cliente/veículo mesmo fora da aba "Dados". */}
      <div className={styles.contextBar}>
        <span className={styles.clientContext}>
          <span className={styles.contextIdentity}>
            <small>Cliente</small>
            <strong>{nomeCliente}</strong>
          </span>
        </span>
        <span>
          <small>Veículo</small>
          <strong>{descricaoVeiculo}</strong>
        </span>
      </div>

      <Tabs
        items={[
          {
            key: 'dados',
            label: osTabLabel('clipboard', 'Dados da OS'),
            mobileLabel: osTabLabel('clipboard', 'Dados'),
          },
          {
            key: 'itens',
            label: osTabLabel(
              'items',
              totalItens > 0 ? `Produtos e Serviços (${totalItens})` : 'Produtos e Serviços',
            ),
            mobileLabel: osTabLabel('items', totalItens > 0 ? `Itens (${totalItens})` : 'Itens'),
          },
          {
            key: 'diagnostico',
            label: osTabLabel('diagnosis', 'Diagnóstico'),
            mobileLabel: osTabLabel('diagnosis', 'Diagnóstico'),
          },
          {
            key: 'fotos',
            label: osTabLabel('photo', 'Fotos'),
            mobileLabel: osTabLabel('photo', 'Fotos'),
          },
          {
            key: 'historico',
            label: osTabLabel('history', 'Histórico'),
            mobileLabel: osTabLabel('history', 'Histórico'),
          },
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
              onTrocarVinculo={podeEditar && totalItens === 0 ? () => setTrocandoVinculo(true) : undefined}
              trocarVinculoBloqueio={podeEditar && totalItens > 0 ? 'Troca só sem produto/serviço lançado.' : undefined}
            />
            <OSVinculoDialog numero={os.numero} open={trocandoVinculo} loading={trocarVinculoMutation.isPending}
              onCancel={() => setTrocandoVinculo(false)} onConfirm={(v) => trocarVinculoMutation.mutate(v)} />
            <section className={styles.section}>
              <OSKmSection kmAtual={os.kmAtual} kmFinal={os.kmFinal} podeEditar={podeEditar}
                salvando={kmMutation.isPending} onDirtyChange={setKmDirty}
                draftStorageKey={userId ? draftKey(userId, 'os', id, 'km') : undefined}
                legacyDraftStorageKey={userId ? draftKey(userId, 'os', id, 'diagnostico') : undefined}
                onSave={(patch) => kmMutation.mutateAsync(patch).then(
                  () => 'ok' as const,
                  async (err: unknown) => {
                    if (err instanceof OfflineQueuedError) return 'queued' as const;
                    if (err instanceof ApiError && err.code === 'OS_CONFLICT') {
                      await queryClient.invalidateQueries({ queryKey: ['os', id] });
                      return 'conflict' as const;
                    }
                    return 'error' as const;
                  },
                )} />
            </section>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Problema relatado</h2>
              <p className={styles.problemaTexto}>{os.problema || 'Não informado.'}</p>
            </section>
          </>
        )}

        {tab === 'diagnostico' && (
          <section className={styles.section}>
            <DiagnosticoSection
              diagnostico={os.diagnostico}
              observacoes={os.observacoes}
              podeEditar={podeEditar}
              salvando={salvarMutation.isPending}
              onSave={(patch) =>
                salvarMutation.mutateAsync(patch).then(
                  () => 'ok' as const,
                  async (err: unknown) => {
                    if (err instanceof OfflineQueuedError) return 'queued' as const;
                    if (err instanceof ApiError && err.code === 'OS_CONFLICT') {
                      // Busca a versão atual pra "Usar a versão atual" mostrar o texto do outro usuário.
                      await queryClient.invalidateQueries({ queryKey: ['os', id] });
                      return 'conflict' as const;
                    }
                    return 'error' as const;
                  },
                )
              }
              onDirtyChange={setDiagnosticoDirty}
              draftStorageKey={userId ? draftKey(userId, 'os', id, 'diagnostico') : undefined}
              legacyKmDraftStorageKey={userId ? draftKey(userId, 'os', id, 'km') : undefined}
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
                  !removerMutation.isPending &&
                  removerMutation.mutate({
                    tipo: 'produto',
                    codigo: row.codigo,
                    descricao: row.descricao,
                    itemId: row.itemId,
                  })
                }
                onRemoverServico={(row: ItemGridRow) =>
                  !removerMutation.isPending &&
                  removerMutation.mutate({
                    tipo: 'servico',
                    codigo: row.codigo,
                    descricao: row.descricao,
                    itemId: row.itemId,
                  })
                }
              />
            </section>

            {mostrarPreco && (
              <section className={styles.financialSummary}>
                <div className={styles.summaryHeading}>
                  <span className={styles.summaryIcon}>
                    <NavIcon name="chart" />
                  </span>
                  <div>
                    <h2>Resumo financeiro</h2>
                    <p>Totais calculados no Firebird pelos itens ativos.</p>
                  </div>
                </div>
                <div className={styles.summaryMetrics}>
                  <div className={styles.summaryMetric}>
                    <span>Total produtos</span>
                    <strong>
                      <CurrencyCell
                        amount={os.produtos
                          .reduce((total, item) => total + (item.total ?? 0), 0)
                          .toFixed(2)}
                      />
                    </strong>
                  </div>
                  <div className={styles.summaryMetric}>
                    <span>Total serviços</span>
                    <strong>
                      <CurrencyCell
                        amount={os.servicos
                          .reduce((total, item) => total + (item.total ?? 0), 0)
                          .toFixed(2)}
                      />
                    </strong>
                  </div>
                  <div className={`${styles.summaryMetric} ${styles.summaryTotal}`}>
                    <span>Total geral</span>
                    <strong>
                      <CurrencyCell amount={(os.faturamento ?? 0).toFixed(2)} />
                    </strong>
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
        open={trocaPendente !== null}
        title="Descartar alterações não salvas?"
        description="Há alterações nesta aba que ainda não foram salvas. Trocar de aba agora descarta o que foi digitado."
        confirmLabel="Descartar e trocar"
        danger
        onCancel={() => setTrocaPendente(null)}
        onConfirm={() => {
          const key = trocaPendente!;
          setTrocaPendente(null);
          setDiagnosticoDirty(false);
          setKmDirty(false);
          if (userId) removeDraft(draftKey(userId, 'os', id, tab === 'dados' ? 'km' : 'diagnostico'));
          aplicarTroca(key);
        }}
      />
      {guard.dialog}
      {messageChannel && (
        <OSMessageDialog
          key={messageChannel}
          id={id}
          clientCode={os.clienteCodigo}
          channel={messageChannel}
          defaultType={
            os.status === 'AGUARDANDO_CLIENTE'
              ? 'aguardando_cliente'
              : os.status === 'AGUARDANDO_PECA'
                ? 'aguardando_peca'
                : os.status === 'CONCLUIDA'
                  ? 'pronta'
                  : 'aberta'
          }
          onClose={() => setMessageChannel(null)}
        />
      )}
    </div>
  );
}
