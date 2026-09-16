import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  adicionarProdutoOS,
  adicionarServicoOS,
  alterarStatusOS,
  atualizarOS,
  criarOS,
  getOS,
  removerProdutoOS,
  removerServicoOS,
} from '../../api/os.api.js';
import { getClienteByCodigo } from '../../api/clientes.api.js';
import { getEquipamentoByCodigo } from '../../api/equipamentos.api.js';
import { listUsers } from '../../api/users.api.js';
import { OS_PRIORIDADE_OPTIONS } from '../../constants/osStatus.js';
import { handleMutationError } from '../../pwa/offlineErrorToast.js';
import { OfflineQueuedError } from '../../pwa/OfflineQueuedError.js';
import { hasPermission } from '../../store/authStore.js';
import type { ClienteDTO, EquipamentoDTO } from '../../types/cherp.types.js';
import { type OSPrioridade, type OSStatus } from '../../types/os.types.js';
import { Button, Card, ConfirmDialog, ErrorState, LinkButton, PageHeader, Select, Skeleton, useToast } from '../ui/index.js';
import { ClienteVeiculoSection } from './ClienteVeiculoSection.js';
import { DiagnosticoSection, type DiagnosticoPatch } from './DiagnosticoSection.js';
import { HistoryTimeline } from './HistoryTimeline.js';
import { OSFormHeader } from './OSFormHeader.js';
import { OSFieldInfo } from './OSFieldInfo.js';
import { ProdutosServicosSection } from './ProdutosServicosSection.js';
import type { ItemGridRow } from './ItemGrid.js';
import styles from './OSForm.module.css';

interface OSFormProps {
  mode: 'create' | 'edit';
  id?: string;
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

  const mutation = useMutation({
    mutationFn: () =>
      criarOS({ clienteCodigo: cliente!.codigo, equipamentoCodigo: equipamento!.codigo, problema, prioridade }),
    onSuccess: (os) => navigate(`/os/${os.id}`, { replace: true }),
    onError: (err) => {
      if (err instanceof OfflineQueuedError) {
        showToast(err.message, 'warning');
        navigate('/os', { replace: true });
      }
    },
  });

  const podeSalvar = cliente && equipamento && problema.trim().length > 0 && !mutation.isPending;

  return (
    <div className={`${styles.page} ${styles.createPage}`}>
      <PageHeader
        title="Nova OS"
        description="Associe o cliente e o veículo para abrir uma ordem de serviço."
        actions={<LinkButton to="/os" variant="secondary">Voltar</LinkButton>}
      />

      <ClienteVeiculoSection
        mode="create"
        cliente={cliente}
        equipamento={equipamento}
        onClienteChange={setCliente}
        onEquipamentoChange={setEquipamento}
      />

      {cliente && equipamento && (
        <Card className={styles.createCard}>
          <div>
            <label
              htmlFor="problema"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}
            >
              Problema relatado
            </label>
            <textarea
              id="problema"
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
              rows={3}
              className={styles.textarea}
            />
          </div>

          <Select
            label="Prioridade"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as OSPrioridade)}
            options={OS_PRIORIDADE_OPTIONS}
          />

          {mutation.isError && (
            <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Erro ao criar OS.'}
            </p>
          )}

          <Button disabled={!podeSalvar} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Criar OS
          </Button>
        </Card>
      )}
    </div>
  );
}

/** Edição: OS já é uma linha real no CHERP — toda seção grava/consulta de verdade a partir daqui. */
function OSFormEdit({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const {
    data: os,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({ queryKey: ['os', id], queryFn: () => getOS(id) });

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

  const podeVerUsuarios = hasPermission('USER_VIEW');
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-atribuicao'],
    queryFn: listUsers,
    enabled: podeVerUsuarios,
  });

  const [removendo, setRemovendo] = useState<{ tipo: 'produto' | 'servico'; codigo: string; descricao: string } | null>(null);

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
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível salvar as alterações. Tente novamente.'),
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
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível atualizar a prioridade.'),
  });

  async function adicionarProduto(codigo: string, quantidade: number) {
    try {
      const atualizado = await adicionarProdutoOS(id, codigo, quantidade);
      queryClient.setQueryData(['os', id], atualizado);
      showToast('Produto adicionado.', 'success');
    } catch (err) {
      if (err instanceof OfflineQueuedError) showToast(err.message, 'warning');
      throw err;
    }
  }

  async function adicionarServico(codigo: string, quantidade: number) {
    try {
      const atualizado = await adicionarServicoOS(id, codigo, quantidade);
      queryClient.setQueryData(['os', id], atualizado);
      showToast('Serviço adicionado.', 'success');
    } catch (err) {
      if (err instanceof OfflineQueuedError) showToast(err.message, 'warning');
      throw err;
    }
  }

  const removerMutation = useMutation({
    mutationFn: () =>
      removendo!.tipo === 'produto' ? removerProdutoOS(id, removendo!.codigo) : removerServicoOS(id, removendo!.codigo),
    onSuccess: async () => {
      await invalidate();
      setRemovendo(null);
      showToast('Removido.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível remover. Tente novamente.'),
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
        <ErrorState title="OS não encontrada" description="Verifique o link ou volte para a lista." />
      </div>
    );
  }

  // OS finalizada: backend já rejeita qualquer mutação (assertNaoFinalizada em os.service.ts) —
  // aqui é só pra não oferecer um controle que vai dar erro ao salvar, a permissão em si continua a mesma.
  const osFinalizada = os.status === 'CONCLUIDA';
  const podeEditar = hasPermission('OS_EDIT') && !osFinalizada;
  const podeAddProduto = hasPermission('PRODUCT_ADD_TO_OS') && !osFinalizada;
  const podeAddServico = hasPermission('SERVICE_ADD_TO_OS') && !osFinalizada;
  const podeMudarStatus = hasPermission('OS_CHANGE_STATUS');
  const mostrarPreco = hasPermission('FINANCIAL_VIEW');

  return (
    <div className={`${styles.page} ${styles.detailPage}`}>
      <OSFormHeader
        numero={os.numero}
        status={os.status}
        prioridade={os.prioridade}
        dataAbertura={os.dataAbertura}
        onRefresh={() => refetch()}
        refreshing={isFetching}
        canChangeStatus={podeMudarStatus}
        canEdit={podeEditar}
        onStatusChange={(status) => statusMutation.mutate(status)}
        onPriorityChange={(prioridade) => prioridadeMutation.mutate(prioridade)}
        updating={statusMutation.isPending || prioridadeMutation.isPending}
      />

      <nav className={styles.tabs} aria-label="Seções da OS"><a href="#dados">▣ Dados da OS</a><a href="#itens">▤ Produtos e Serviços</a><a href="#diagnostico">▱ Diagnóstico</a><a href="#historico">◷ Histórico</a></nav>

      <section className={styles.identity}>
        <ClienteVeiculoSection
          mode="edit"
          clienteCodigo={os.clienteCodigo}
          clienteNome={cliente?.nome ?? os.clienteCodigo}
          veiculoDescricao={equipamento?.descricao ?? os.equipamentoCodigo}
        />
      </section>

      <section id="dados" className={styles.section}>
        <h2 className={styles.sectionTitle}>▣ Dados da OS</h2>
        <div className={styles.dataGrid}>
          <label><OSFieldInfo field="cliente">Cliente</OSFieldInfo><input value={`${os.clienteCodigo} - ${cliente?.nome ?? os.clienteNome ?? ''}`} readOnly /></label>
          <label><OSFieldInfo field="veiculo">Veículo</OSFieldInfo><input value={equipamento?.descricao ?? os.equipamentoDescricao ?? os.equipamentoCodigo} readOnly /></label>
          <label><OSFieldInfo field="dav">Nº DAV</OSFieldInfo><input value={os.nroDav ?? 'Não informado'} readOnly /></label>
          <label><OSFieldInfo field="kmAtual">KM na abertura</OSFieldInfo><input value={os.kmAtual ?? 0} readOnly /></label>
          <label><OSFieldInfo field="responsavel">Responsável</OSFieldInfo><input value={os.responsavelId ? 'Atribuído' : 'Selecione...'} readOnly /></label>
          <label><OSFieldInfo field="tecnico">Técnico</OSFieldInfo><input value={os.tecnicoId ? 'Atribuído' : 'Selecione...'} readOnly /></label>
          <label><OSFieldInfo field="previsao">Previsão</OSFieldInfo><input value={os.dataPrevista ? new Date(os.dataPrevista).toLocaleDateString('pt-BR') : 'dd/mm/aaaa'} readOnly /></label>
          <label><OSFieldInfo field="kmFinal">KM na entrega</OSFieldInfo><input value={os.kmFinal ?? 0} readOnly /></label>
          <label className={styles.spanTwo}><OSFieldInfo field="solucao">Serviço realizado</OSFieldInfo><input value={os.solucao ?? os.problema} readOnly /></label>
          <label className={styles.spanTwo}><OSFieldInfo field="observacoes">Observações</OSFieldInfo><input value={os.observacoes ?? 'Informações adicionais sobre a OS...'} readOnly /></label>
        </div>
      </section>

      <section id="diagnostico" className={styles.section}>
        <DiagnosticoSection
          diagnostico={os.diagnostico}
          observacoes={os.observacoes}
          solucao={os.solucao}
          prioridade={os.prioridade}
          responsavelId={os.responsavelId}
          tecnicoId={os.tecnicoId}
          dataPrevista={os.dataPrevista}
          nroDav={os.nroDav}
          kmAtual={os.kmAtual}
          kmFinal={os.kmFinal}
          frete={os.frete}
          totalIpi={os.totalIpi}
          mostrarFinanceiro={mostrarPreco}
          podeEditar={podeEditar}
          podeVerUsuarios={podeVerUsuarios}
          usuarios={usuarios ?? []}
          salvando={salvarMutation.isPending}
          onSave={(patch) => salvarMutation.mutate(patch)}
        />
      </section>

      <section id="itens" className={`${styles.section} ${styles.itemsSection}`}>
        <ProdutosServicosSection
          produtos={os.produtos}
          servicos={os.servicos}
          faturamento={os.faturamento}
          podeAddProduto={podeAddProduto}
          podeAddServico={podeAddServico}
          mostrarPreco={mostrarPreco}
          onAdicionarProduto={adicionarProduto}
          onAdicionarServico={adicionarServico}
          onRemoverProduto={(row: ItemGridRow) => setRemovendo({ tipo: 'produto', codigo: row.codigo, descricao: row.descricao })}
          onRemoverServico={(row: ItemGridRow) => setRemovendo({ tipo: 'servico', codigo: row.codigo, descricao: row.descricao })}
        />
      </section>

      {mostrarPreco && <section className={styles.financialSummary}><div><h2>▦ Resumo financeiro</h2><p>Totais calculados no Firebird pelos itens ativos.</p></div><div><span>Total produtos</span><strong>R$ {os.produtos.reduce((total, item) => total + (item.total ?? 0), 0).toFixed(2)}</strong><span>Total serviços</span><strong>R$ {os.servicos.reduce((total, item) => total + (item.total ?? 0), 0).toFixed(2)}</strong><b>Total geral <em>R$ {(os.faturamento ?? 0).toFixed(2)}</em></b></div></section>}

      <section id="historico" className={styles.section}>
        <h2 style={{ fontSize: 'var(--font-size-md)', margin: '0 0 var(--space-2)' }}>Histórico</h2>
        <HistoryTimeline entries={os.historico} />
      </section>

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
    </div>
  );
}
