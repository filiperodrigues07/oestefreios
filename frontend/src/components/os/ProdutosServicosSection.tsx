import { searchProdutos } from '../../api/produtos.api.js';
import { searchServicos } from '../../api/servicos.api.js';
import { ItemGrid, type ItemGridRow } from './ItemGrid.js';
import type { OSItemProduto, OSItemServico } from '../../types/os.types.js';

interface ProdutosServicosSectionProps {
  produtos: OSItemProduto[];
  servicos: OSItemServico[];
  faturamento?: number;
  podeAddProduto: boolean;
  podeAddServico: boolean;
  mostrarPreco: boolean;
  onAdicionarProduto: (codigo: string, quantidade: number) => Promise<unknown>;
  onAdicionarServico: (codigo: string, quantidade: number) => Promise<unknown>;
  onRemoverProduto: (row: ItemGridRow) => void;
  onRemoverServico: (row: ItemGridRow) => void;
}

/** Produtos + Serviços lançados na OS — reaproveita o ItemGrid (Fase H) sem tocar sua lógica de persistência. */
export function ProdutosServicosSection({
  produtos,
  servicos,
  faturamento,
  podeAddProduto,
  podeAddServico,
  mostrarPreco,
  onAdicionarProduto,
  onAdicionarServico,
  onRemoverProduto,
  onRemoverServico,
}: ProdutosServicosSectionProps) {
  const produtosGrid: ItemGridRow[] = produtos.map((p) => ({
    codigo: p.produtoCodigo,
    descricao: p.descricao,
    unidade: p.unidade,
    quantidade: p.quantidade,
    precoUnitario: p.precoUnitario,
    total: p.total,
  }));

  const servicosGrid: ItemGridRow[] = servicos.map((s) => ({
    codigo: s.servicoCodigo,
    descricao: s.descricao,
    unidade: s.unidade,
    quantidade: s.quantidade,
    precoUnitario: s.valorUnitario,
    total: s.total,
  }));

  return (
    <>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-md)', margin: '0 0 var(--space-2)' }}>Produtos</h2>
        <ItemGrid
          itens={produtosGrid}
          queryKeyPrefix="os-grid-produtos"
          buscar={(query) =>
            searchProdutos(query).then((r) =>
              r.items.map((p) => ({ codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, precoUnitario: p.precoUnitario })),
            )
          }
          onAdicionar={onAdicionarProduto}
          onRemover={onRemoverProduto}
          podeEditar={podeAddProduto}
          mostrarPreco={mostrarPreco}
          vazio="Nenhum produto lançado."
          placeholder="Código ou descrição do produto"
        />
      </div>

      <div>
        <h2 style={{ fontSize: 'var(--font-size-md)', margin: '0 0 var(--space-2)' }}>Serviços</h2>
        <ItemGrid
          itens={servicosGrid}
          queryKeyPrefix="os-grid-servicos"
          buscar={(query) =>
            searchServicos(query).then((r) =>
              r.items.map((s) => ({ codigo: s.codigo, descricao: s.descricao, unidade: s.unidade, precoUnitario: s.valorUnitario })),
            )
          }
          onAdicionar={onAdicionarServico}
          onRemover={onRemoverServico}
          podeEditar={podeAddServico}
          mostrarPreco={mostrarPreco}
          vazio="Nenhum serviço lançado."
          placeholder="Código ou descrição do serviço"
        />
        {faturamento !== undefined && (
          <p style={{ textAlign: 'right', fontWeight: 600, marginTop: 'var(--space-2)' }}>Total geral: R$ {faturamento.toFixed(2)}</p>
        )}
      </div>
    </>
  );
}
