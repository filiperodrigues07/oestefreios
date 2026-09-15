import { useState } from 'react';
import { listarProdutosCatalogo } from '../api/produtos.api.js';
import { listarServicosCatalogo } from '../api/servicos.api.js';
import { CatalogList } from '../components/catalog/CatalogList.js';
import { Modal } from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { ProdutoDTO, ServicoDTO } from '../types/cherp.types.js';

type Tab = 'produtos' | 'servicos';

function formatMoney(value?: number): string | undefined {
  return value !== undefined ? `R$ ${value.toFixed(2)}` : undefined;
}

/**
 * Consulta de Produtos e Serviços do CHERP (seções 10 e 12 do briefing).
 * Preço/custo/valor só aparecem se o backend os enviar (perfil com
 * FINANCIAL_VIEW) — a UI nunca decide isso, só reflete o que chega.
 */
export function ProdutosPage() {
  const [tab, setTab] = useState<Tab>('produtos');
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDTO | null>(null);
  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoDTO | null>(null);
  const podeVerFinanceiro = hasPermission('FINANCIAL_VIEW');

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xl)' }}>Produtos e Serviços</h1>

      <div role="tablist" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <TabButton active={tab === 'produtos'} onClick={() => setTab('produtos')}>
          Produtos
        </TabButton>
        <TabButton active={tab === 'servicos'} onClick={() => setTab('servicos')}>
          Serviços
        </TabButton>
      </div>

      {tab === 'produtos' ? (
        <CatalogList<ProdutoDTO>
          key="produtos"
          queryKey="produtos-catalogo"
          fetchFn={listarProdutosCatalogo}
          onSelect={setProdutoSelecionado}
          emptyLabel="Nenhum produto encontrado."
          renderPrice={(p) => formatMoney(p.precoUnitario)}
        />
      ) : (
        <CatalogList<ServicoDTO>
          key="servicos"
          queryKey="servicos-catalogo"
          fetchFn={listarServicosCatalogo}
          onSelect={setServicoSelecionado}
          emptyLabel="Nenhum serviço encontrado."
          renderPrice={(s) => formatMoney(s.valorUnitario)}
        />
      )}

      <Modal open={produtoSelecionado !== null} title="Detalhe do produto" onClose={() => setProdutoSelecionado(null)}>
        {produtoSelecionado && (
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <DetailRow label="Código" value={produtoSelecionado.codigo} />
            <DetailRow label="Descrição" value={produtoSelecionado.descricao} />
            <DetailRow label="Unidade" value={produtoSelecionado.unidade} />
            {produtoSelecionado.disponivel !== undefined && (
              <DetailRow label="Disponível" value={String(produtoSelecionado.disponivel)} />
            )}
            {podeVerFinanceiro && produtoSelecionado.precoUnitario !== undefined && (
              <DetailRow label="Preço unitário" value={formatMoney(produtoSelecionado.precoUnitario)!} />
            )}
            {podeVerFinanceiro && produtoSelecionado.custo !== undefined && (
              <DetailRow label="Custo" value={formatMoney(produtoSelecionado.custo)!} />
            )}
          </dl>
        )}
      </Modal>

      <Modal open={servicoSelecionado !== null} title="Detalhe do serviço" onClose={() => setServicoSelecionado(null)}>
        {servicoSelecionado && (
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <DetailRow label="Código" value={servicoSelecionado.codigo} />
            <DetailRow label="Descrição" value={servicoSelecionado.descricao} />
            <DetailRow label="Unidade" value={servicoSelecionado.unidade} />
            {podeVerFinanceiro && servicoSelecionado.valorUnitario !== undefined && (
              <DetailRow label="Valor" value={formatMoney(servicoSelecionado.valorUnitario)!} />
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        background: active ? 'var(--color-primary)' : 'var(--color-surface)',
        color: active ? '#fff' : 'var(--color-text-primary)',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: 500 }}>{value}</dd>
    </div>
  );
}
