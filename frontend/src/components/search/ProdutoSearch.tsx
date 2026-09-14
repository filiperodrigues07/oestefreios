import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { searchProdutos } from '../../api/produtos.api.js';
import type { ProdutoDTO } from '../../types/cherp.types.js';
import { SearchCombobox, type SearchComboboxItem } from '../ui/SearchCombobox.js';

interface ProdutoItem extends SearchComboboxItem {
  produto: ProdutoDTO;
}

interface ProdutoSearchProps {
  label?: string;
  onSelect: (produto: ProdutoDTO) => void;
}

/**
 * Busca de produto por código (zeros à esquerda preservados) ou descrição,
 * consultando o CHERP via GET /api/produtos. Preço só aparece se o backend
 * o enviar (perfil com FINANCIAL_VIEW) — nunca decidido no frontend.
 */
export function ProdutoSearch({ label = 'Produto', onSelect }: ProdutoSearchProps) {
  const [query, setQuery] = useState('');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['produtos-search', query],
    queryFn: () => searchProdutos(query),
    enabled: query.length > 0,
  });

  const items: ProdutoItem[] = (data?.items ?? []).map((produto) => ({
    key: produto.codigo,
    code: produto.codigo,
    description: produto.descricao,
    produto,
  }));

  return (
    <SearchCombobox<ProdutoItem>
      label={label}
      placeholder="Código ou descrição do produto"
      items={items}
      isLoading={isFetching}
      isError={isError}
      onQueryChange={setQuery}
      onSelect={(item) => onSelect(item.produto)}
      renderItem={(item) => (
        <>
          <span>
            {item.produto.descricao} <small style={{ color: 'var(--color-text-secondary)' }}>({item.produto.unidade})</small>
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {item.produto.codigo}
            {item.produto.precoUnitario !== undefined && ` · R$ ${item.produto.precoUnitario.toFixed(2)}`}
          </span>
        </>
      )}
    />
  );
}
