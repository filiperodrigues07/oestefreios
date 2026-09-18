import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { searchEquipamentosPorPlaca } from '../../api/equipamentos.api.js';
import type { EquipamentoDTO } from '../../types/cherp.types.js';
import { RequiredMark } from '../ui/RequiredMark.js';
import { SearchCombobox, type SearchComboboxItem } from '../ui/SearchCombobox.js';

interface PlacaItem extends SearchComboboxItem {
  equipamento: EquipamentoDTO;
}

interface PlacaSearchProps {
  onSelect: (equipamento: EquipamentoDTO) => void;
  /** Texto digitado (pós-debounce) — usado pra pré-preencher o cadastro manual quando a placa não existe. */
  onQueryChange?: (query: string) => void;
}

/**
 * Busca de veículo por placa em todo o CHERP, sem cliente pré-selecionado (fluxo placa-primeiro
 * da OS, item 9 da rodada). Diferente de `EquipamentoSearch` (que só busca dentro de um cliente
 * já escolhido), esta procura na base inteira — por isso não lista tudo por padrão (`minChars`
 * default), só o F8/termo digitado, igual `ProdutoSearch`/`ServicoSearch` com catálogos grandes.
 */
export function PlacaSearch({ onSelect, onQueryChange }: PlacaSearchProps) {
  const [query, setQuery] = useState('');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['equipamentos-busca-placa', query],
    queryFn: () => searchEquipamentosPorPlaca(query),
  });

  const items: PlacaItem[] = (data?.items ?? []).map((equipamento) => ({
    key: equipamento.codigo,
    code: equipamento.codigo,
    description: equipamento.descricao,
    equipamento,
  }));

  return (
    <SearchCombobox<PlacaItem>
      label={<>Placa<RequiredMark /></>}
      placeholder="Digite a placa do veículo"
      items={items}
      isLoading={isFetching}
      isError={isError}
      onQueryChange={(q) => {
        setQuery(q);
        onQueryChange?.(q);
      }}
      onSelect={(item) => onSelect(item.equipamento)}
      renderItem={(item) => (
        <>
          <span>{item.equipamento.descricao}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {item.equipamento.identificacao ?? item.equipamento.codigo}
          </span>
        </>
      )}
    />
  );
}
