import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { useParams } from 'react-router';
import {
  adicionarProdutoOS,
  adicionarServicoOS,
  alterarStatusOS,
  atualizarOS,
  getOS,
  removerProdutoOS,
  removerServicoOS,
} from '../api/os.api.js';
import { getClienteByCodigo } from '../api/clientes.api.js';
import { getEquipamentoByCodigo } from '../api/equipamentos.api.js';
import { HistoryTimeline } from '../components/os/HistoryTimeline.js';
import { StatusChanger } from '../components/os/StatusChanger.js';
import { ProdutoSearch } from '../components/search/ProdutoSearch.js';
import { ServicoSearch } from '../components/search/ServicoSearch.js';
import {
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  ErrorState,
  PriorityBadge,
  Skeleton,
  StatusBadge,
  useToast,
} from '../components/ui/index.js';
import { handleMutationError } from '../pwa/offlineErrorToast.js';
import { hasPermission } from '../store/authStore.js';
import type { ProdutoDTO, ServicoDTO } from '../types/cherp.types.js';
import type { OSStatus } from '../types/os.types.js';

const sectionStyle: CSSProperties = {
  borderTop: '1px solid var(--color-border)',
  paddingTop: 'var(--space-4)',
  marginTop: 'var(--space-4)',
};

export function OSDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: os, isLoading, isError } = useQuery({
    queryKey: ['os', id],
    queryFn: () => getOS(id!),
    enabled: !!id,
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

  const [diagnostico, setDiagnostico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [solucao, setSolucao] = useState('');
  const [editando, setEditando] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState<'produto' | 'servico' | null>(null);
  const [removendo, setRemovendo] = useState<{ tipo: 'produto' | 'servico'; codigo: string; descricao: string } | null>(
    null,
  );

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['os', id] });
  }

  const salvarMutation = useMutation({
    mutationFn: () => atualizarOS(id!, { diagnostico, observacoes, solucao }),
    onSuccess: async () => {
      await invalidate();
      setEditando(false);
      showToast('Alterações salvas.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível salvar as alterações. Tente novamente.'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: OSStatus) => alterarStatusOS(id!, status),
    onSuccess: async () => {
      await invalidate();
      showToast('Status alterado.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível alterar o status.'),
  });

  const addProdutoMutation = useMutation({
    mutationFn: (produto: ProdutoDTO) => adicionarProdutoOS(id!, produto.codigo, 1),
    onSuccess: async () => {
      await invalidate();
      setDrawerAberto(null);
      showToast('Produto adicionado.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível adicionar o produto.'),
  });

  const addServicoMutation = useMutation({
    mutationFn: (servico: ServicoDTO) => adicionarServicoOS(id!, servico.codigo, 1),
    onSuccess: async () => {
      await invalidate();
      setDrawerAberto(null);
      showToast('Serviço adicionado.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível adicionar o serviço.'),
  });

  const removerMutation = useMutation({
    mutationFn: () =>
      removendo!.tipo === 'produto' ? removerProdutoOS(id!, removendo!.codigo) : removerServicoOS(id!, removendo!.codigo),
    onSuccess: async () => {
      await invalidate();
      setRemovendo(null);
      showToast('Removido.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível remover. Tente novamente.'),
  });

  function iniciarEdicao() {
    if (!os) return;
    setDiagnostico(os.diagnostico ?? '');
    setObservacoes(os.observacoes ?? '');
    setSolucao(os.solucao ?? '');
    setEditando(true);
  }

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)', maxWidth: 720 }}>
        <Skeleton height={32} width={240} />
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Skeleton height={120} />
        </div>
      </div>
    );
  }

  if (isError || !os) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <ErrorState title="OS não encontrada" description="Verifique o link ou volte para a lista." />
      </div>
    );
  }

  const podeEditar = hasPermission('OS_EDIT');
  const podeAddProduto = hasPermission('PRODUCT_ADD_TO_OS');
  const podeAddServico = hasPermission('SERVICE_ADD_TO_OS');
  const podeMudarStatus = hasPermission('OS_CHANGE_STATUS');

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 720 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>OS #{os.numero}</h1>
          <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Aberta em {new Date(os.dataAbertura).toLocaleString('pt-BR')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <PriorityBadge priority={os.prioridade} />
          <StatusBadge status={os.status} />
        </div>
      </header>

      <section style={sectionStyle}>
        <Card style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Cliente</div>
            <div style={{ fontWeight: 600 }}>{cliente?.nome ?? os.clienteCodigo}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Equipamento</div>
            <div style={{ fontWeight: 600 }}>{equipamento?.descricao ?? os.equipamentoCodigo}</div>
          </div>
        </Card>
      </section>

      {podeMudarStatus && (
        <section style={sectionStyle}>
          <StatusChanger current={os.status} onChange={(s) => statusMutation.mutate(s)} loading={statusMutation.isPending} />
        </section>
      )}

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 'var(--font-size-md)', margin: '0 0 var(--space-2)' }}>Problema</h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{os.problema}</p>
      </section>

      <section style={sectionStyle}>
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
            <TextBlock label="Diagnóstico" value={os.diagnostico} />
            <TextBlock label="Observações" value={os.observacoes} />
            <TextBlock label="Solução realizada" value={os.solucao} />
          </div>
        ) : (
          <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <EditTextarea label="Diagnóstico" value={diagnostico} onChange={setDiagnostico} />
            <EditTextarea label="Observações" value={observacoes} onChange={setObservacoes} />
            <EditTextarea label="Solução realizada" value={solucao} onChange={setSolucao} />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button size="sm" loading={salvarMutation.isPending} onClick={() => salvarMutation.mutate()}>
                Salvar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <h2 style={{ fontSize: 'var(--font-size-md)', margin: 0 }}>Produtos</h2>
          {podeAddProduto && (
            <Button size="sm" variant="secondary" onClick={() => setDrawerAberto('produto')}>
              + Adicionar produto
            </Button>
          )}
        </div>
        {os.produtos.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Nenhum produto lançado.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {os.produtos.map((p) => (
            <ItemRow
              key={p.produtoCodigo}
              descricao={p.descricao}
              detalhe={`${p.unidade} · qtd ${p.quantidade}${p.total !== undefined ? ` · R$ ${p.total.toFixed(2)}` : ''}`}
              onRemover={
                podeAddProduto ? () => setRemovendo({ tipo: 'produto', codigo: p.produtoCodigo, descricao: p.descricao }) : undefined
              }
            />
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <h2 style={{ fontSize: 'var(--font-size-md)', margin: 0 }}>Serviços</h2>
          {podeAddServico && (
            <Button size="sm" variant="secondary" onClick={() => setDrawerAberto('servico')}>
              + Adicionar serviço
            </Button>
          )}
        </div>
        {os.servicos.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Nenhum serviço lançado.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {os.servicos.map((s) => (
            <ItemRow
              key={s.servicoCodigo}
              descricao={s.descricao}
              detalhe={`${s.unidade} · qtd ${s.quantidade}${s.total !== undefined ? ` · R$ ${s.total.toFixed(2)}` : ''}`}
              onRemover={
                podeAddServico ? () => setRemovendo({ tipo: 'servico', codigo: s.servicoCodigo, descricao: s.descricao }) : undefined
              }
            />
          ))}
        </div>
        {os.faturamento !== undefined && (
          <p style={{ textAlign: 'right', fontWeight: 600, marginTop: 'var(--space-2)' }}>
            Total: R$ {os.faturamento.toFixed(2)}
          </p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 'var(--font-size-md)', margin: '0 0 var(--space-2)' }}>Histórico</h2>
        <HistoryTimeline entries={os.historico} />
      </section>

      <Drawer open={drawerAberto === 'produto'} title="Adicionar produto" onClose={() => setDrawerAberto(null)}>
        <ProdutoSearch onSelect={(p) => addProdutoMutation.mutate(p)} />
      </Drawer>

      <Drawer open={drawerAberto === 'servico'} title="Adicionar serviço" onClose={() => setDrawerAberto(null)}>
        <ServicoSearch onSelect={(s) => addServicoMutation.mutate(s)} />
      </Drawer>

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

function TextBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</div>
      <div>{value?.trim() ? value : <span style={{ color: 'var(--color-text-secondary)' }}>Não informado.</span>}</div>
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

function ItemRow({ descricao, detalhe, onRemover }: { descricao: string; detalhe: string; onRemover?: () => void }) {
  return (
    <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{descricao}</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{detalhe}</div>
      </div>
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
        >
          Remover
        </button>
      )}
    </Card>
  );
}
