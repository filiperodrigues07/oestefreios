import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { searchServicos } from '../../api/servicos.api.js';
import type { ServicoDTO } from '../../types/cherp.types.js';
import { SearchCombobox, type SearchComboboxItem } from '../ui/SearchCombobox.js';

interface ServicoItem extends SearchComboboxItem {
  servico: ServicoDTO;
}

interface ServicoSearchProps {
  label?: string;
  onSelect: (servico: ServicoDTO) => void;
}

export function ServicoSearch({ label = 'Serviço', onSelect }: ServicoSearchProps) {
  const [query, setQuery] = useState('');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['servicos-search', query],
    queryFn: () => searchServicos(query),
    enabled: query.length > 0,
  });

  const items: ServicoItem[] = (data?.items ?? []).map((servico) => ({
    key: servico.codigo,
    code: servico.codigo,
    description: servico.descricao,
    servico,
  }));

  return (
    <SearchCombobox<ServicoItem>
      label={label}
      placeholder="Código ou descrição do serviço"
      items={items}
      isLoading={isFetching}
      isError={isError}
      onQueryChange={setQuery}
      onSelect={(item) => onSelect(item.servico)}
      renderItem={(item) => (
        <>
          <span>
            {item.servico.descricao}{' '}
            <small style={{ color: 'var(--color-text-secondary)' }}>({item.servico.unidade})</small>
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {item.servico.codigo}
            {item.servico.valorUnitario !== undefined && ` · R$ ${item.servico.valorUnitario.toFixed(2)}`}
          </span>
        </>
      )}
    />
  );
}
