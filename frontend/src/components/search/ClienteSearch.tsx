import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { searchClientes } from '../../api/clientes.api.js';
import type { ClienteDTO } from '../../types/cherp.types.js';
import { RequiredMark } from '../ui/RequiredMark.js';
import { SearchCombobox, type SearchComboboxItem } from '../ui/SearchCombobox.js';

interface ClienteItem extends SearchComboboxItem {
  cliente: ClienteDTO;
}

interface ClienteSearchProps {
  label?: ReactNode;
  onSelect: (cliente: ClienteDTO) => void;
}

/** Busca de cliente por código ou nome (seção 8 do briefing). */
export function ClienteSearch({ label = <>Cliente<RequiredMark /></>, onSelect }: ClienteSearchProps) {
  const [query, setQuery] = useState('');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['clientes-search', query],
    queryFn: () => searchClientes(query),
  });

  const items: ClienteItem[] = (data?.items ?? []).map((cliente) => ({
    key: cliente.codigo,
    code: cliente.codigo,
    description: cliente.nome,
    cliente,
  }));

  return (
    <SearchCombobox<ClienteItem>
      label={label}
      placeholder="Nome ou código do cliente"
      items={items}
      isLoading={isFetching}
      isError={isError}
      onQueryChange={setQuery}
      onSelect={(item) => onSelect(item.cliente)}
      renderItem={(item) => (
        <>
          <span>{item.cliente.nome}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {item.cliente.codigo}
            {item.cliente.documento && ` · ${item.cliente.documento}`}
          </span>
        </>
      )}
    />
  );
}
