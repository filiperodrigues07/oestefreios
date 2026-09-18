import { getProdutoByCodigo, searchProdutos } from '../../api/produtos.api.js';
import { getServicoByCodigo, searchServicos } from '../../api/servicos.api.js';
import { ApiError } from '../../api/httpClient.js';
import { ItemGrid, type ItemGridCandidate, type ItemGridRow } from './ItemGrid.js';
import type { OSItemProduto, OSItemServico } from '../../types/os.types.js';

interface ProdutosServicosSectionProps {
  produtos: OSItemProduto[];
  servicos: OSItemServico[];
  faturamento?: number;
  podeAddProduto: boolean;
  podeAddServico: boolean;
  mostrarPreco: boolean;
  podeEditarPreco: boolean;
  onAdicionarProduto: (codigo: string, quantidade: number, precoUnitario?: number, descricaoComplementar?: string) => Promise<unknown>;
  onAdicionarServico: (codigo: string, quantidade: number, valorUnitario?: number, descricaoComplementar?: string) => Promise<unknown>;
  onAtualizarProduto: (codigo: string, patch: { quantidade?: number; precoUnitario?: number; descricaoComplementar?: string }) => Promise<unknown>;
  onAtualizarServico: (codigo: string, patch: { quantidade?: number; precoUnitario?: number; descricaoComplementar?: string }) => Promise<unknown>;
  onRemoverProduto: (row: ItemGridRow) => void;
  onRemoverServico: (row: ItemGridRow) => void;
}

/** 404 do lookup por código exato vira "não encontrado" (null) pro ItemGrid; outros erros propagam. */
async function buscarProdutoPorCodigo(codigo: string): Promise<ItemGridCandidate | null> {
  try {
    const p = await getProdutoByCodigo(codigo);
    return { codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, precoUnitario: p.precoUnitario };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'PRODUCT_NOT_FOUND') return null;
    throw err;
  }
}

async function buscarServicoPorCodigo(codigo: string): Promise<ItemGridCandidate | null> {
  try {
    const s = await getServicoByCodigo(codigo);
    return { codigo: s.codigo, descricao: s.descricao, unidade: s.unidade, precoUnitario: s.valorUnitario };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'SERVICE_NOT_FOUND') return null;
    throw err;
  }
}

/** Produtos + Serviços lançados na OS — reaproveita o ItemGrid (Fase H) sem tocar sua lógica de persistência. */
export function ProdutosServicosSection({
  produtos,
  servicos,
  faturamento,
  podeAddProduto,
  podeAddServico,
  mostrarPreco,
  podeEditarPreco,
  onAdicionarProduto,
  onAdicionarServico,
  onAtualizarProduto,
  onAtualizarServico,
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
    descricaoComplementar: p.descricaoComplementar,
  }));

  const servicosGrid: ItemGridRow[] = servicos.map((s) => ({
    codigo: s.servicoCodigo,
    descricao: s.descricao,
    unidade: s.unidade,
    quantidade: s.quantidade,
    precoUnitario: s.valorUnitario,
    total: s.total,
    descricaoComplementar: s.descricaoComplementar,
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
          buscarPorCodigo={buscarProdutoPorCodigo}
          onAdicionar={onAdicionarProduto}
          onAtualizar={onAtualizarProduto}
          onRemover={onRemoverProduto}
          podeEditar={podeAddProduto}
          mostrarPreco={mostrarPreco}
          podeEditarPreco={podeEditarPreco}
          vazio="Nenhum produto lançado."
          placeholder="Descrição do produto"
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
          buscarPorCodigo={buscarServicoPorCodigo}
          onAdicionar={onAdicionarServico}
          onAtualizar={onAtualizarServico}
          onRemover={onRemoverServico}
          podeEditar={podeAddServico}
          mostrarPreco={mostrarPreco}
          podeEditarPreco={podeEditarPreco}
          vazio="Nenhum serviço lançado."
          placeholder="Descrição do serviço"
        />
        {faturamento !== undefined && (
          <p style={{ textAlign: 'right', fontWeight: 600, marginTop: 'var(--space-2)' }}>Total geral: R$ {faturamento.toFixed(2)}</p>
        )}
      </div>
    </>
  );
}
