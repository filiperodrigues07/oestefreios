import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { searchEquipamentos } from '../../api/equipamentos.api.js';
import type { EquipamentoDTO } from '../../types/cherp.types.js';
import { SearchCombobox, type SearchComboboxItem } from '../ui/SearchCombobox.js';

interface EquipamentoItem extends SearchComboboxItem {
  equipamento: EquipamentoDTO;
}

interface EquipamentoSearchProps {
  label?: string;
  clienteCodigo: string;
  onSelect: (equipamento: EquipamentoDTO) => void;
}

/** Busca de veículo restrita ao cliente já selecionado (seção 8 do briefing). */
export function EquipamentoSearch({ label = 'Veículo', clienteCodigo, onSelect }: EquipamentoSearchProps) {
  const [query, setQuery] = useState('');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['equipamentos-search', clienteCodigo, query],
    queryFn: () => searchEquipamentos(query, clienteCodigo),
    enabled: clienteCodigo.length > 0,
  });

  const items: EquipamentoItem[] = (data?.items ?? []).map((equipamento) => ({
    key: equipamento.codigo,
    code: equipamento.codigo,
    description: equipamento.descricao,
    equipamento,
  }));

  return (
    <SearchCombobox<EquipamentoItem>
      label={label}
      placeholder="Placa, descrição ou código do veículo"
      items={items}
      isLoading={isFetching}
      isError={isError}
      minChars={0}
      onQueryChange={setQuery}
      onSelect={(item) => onSelect(item.equipamento)}
      renderItem={(item) => (
        <>
          <span>{item.equipamento.descricao}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {item.equipamento.codigo}
            {item.equipamento.identificacao && ` · ${item.equipamento.identificacao}`}
          </span>
        </>
      )}
    />
  );
}
