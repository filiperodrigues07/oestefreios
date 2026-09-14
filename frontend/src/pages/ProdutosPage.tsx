import { useState } from 'react';
import { ProdutoSearch } from '../components/search/ProdutoSearch.js';
import { Card, ConfirmDialog, EmptyState } from '../components/ui/index.js';
import type { ProdutoDTO } from '../types/cherp.types.js';

/**
 * Consulta de produtos do CHERP (seção 10 do briefing). Preço/custo só aparecem
 * se o backend os enviar — nunca decidido aqui no frontend.
 * A tela completa de catálogo com filtros avançados chega na Fase 6; esta já
 * prova a busca por código/descrição ponta a ponta contra a API real.
 */
export function ProdutosPage() {
  const [selecionados, setSelecionados] = useState<ProdutoDTO[]>([]);
  const [paraRemover, setParaRemover] = useState<string | null>(null);

  function adicionar(produto: ProdutoDTO) {
    setSelecionados((prev) => (prev.some((p) => p.codigo === produto.codigo) ? prev : [...prev, produto]));
  }

  function remover(codigo: string) {
    setSelecionados((prev) => prev.filter((p) => p.codigo !== codigo));
    setParaRemover(null);
  }

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xl)' }}>Produtos</h1>

      <ProdutoSearch onSelect={adicionar} />

      <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {selecionados.length === 0 && (
          <EmptyState title="Nenhum produto selecionado" description="Busque por código ou descrição acima." />
        )}
        {selecionados.map((produto) => (
          <Card key={produto.codigo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{produto.descricao}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {produto.codigo} · {produto.unidade}
                {produto.precoUnitario !== undefined && ` · R$ ${produto.precoUnitario.toFixed(2)}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setParaRemover(produto.codigo)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-danger)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              Remover
            </button>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={paraRemover !== null}
        title="Remover produto?"
        description="Esta ação removerá o produto da lista."
        confirmLabel="Remover"
        danger
        onCancel={() => setParaRemover(null)}
        onConfirm={() => paraRemover && remover(paraRemover)}
      />
    </div>
  );
}
