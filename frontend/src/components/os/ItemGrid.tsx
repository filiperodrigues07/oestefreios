import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState, type KeyboardEvent } from 'react';
import { SearchCombobox, type SearchComboboxHandle, type SearchComboboxItem } from '../ui/SearchCombobox.js';
import styles from './ItemGrid.module.css';

export interface ItemGridRow {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario?: number;
  total?: number;
}

export interface ItemGridCandidate {
  codigo: string;
  descricao: string;
  unidade: string;
  precoUnitario?: number;
}

type ComboItem = ItemGridCandidate & SearchComboboxItem;

interface ItemGridProps {
  itens: ItemGridRow[];
  queryKeyPrefix: string;
  buscar: (query: string) => Promise<ItemGridCandidate[]>;
  onAdicionar: (codigo: string, quantidade: number) => Promise<unknown>;
  onRemover: (row: ItemGridRow) => void;
  podeEditar: boolean;
  mostrarPreco: boolean;
  vazio: string;
  placeholder: string;
}

/**
 * Grid de lançamento inline (item 6 da rodada de melhorias) — código/descrição com busca
 * (F8 lista tudo, Enter confirma), quantidade e confirmação, sem sair da tela nem abrir modal
 * por item. Desktop mostra tabela, mobile mostra lista de cards (Fase OS-5) — mesmo estado,
 * mesmos handlers, só o markup de exibição dos itens muda por CSS (`.table`/`.cardList`); os
 * controles de adicionar (busca + quantidade + confirmar) são um único bloco que reflui via
 * flexbox, sem duplicar o SearchCombobox nem abrir um caminho de API novo.
 */
export function ItemGrid({
  itens,
  queryKeyPrefix,
  buscar,
  onAdicionar,
  onRemover,
  podeEditar,
  mostrarPreco,
  vazio,
  placeholder,
}: ItemGridProps) {
  const [query, setQuery] = useState('');
  const [selecionado, setSelecionado] = useState<ItemGridCandidate | null>(null);
  const [quantidade, setQuantidade] = useState('1');
  const [erro, setErro] = useState<string | null>(null);
  const comboRef = useRef<SearchComboboxHandle>(null);
  const qtdRef = useRef<HTMLInputElement>(null);

  const { data: candidatos, isFetching, isError } = useQuery({
    queryKey: [queryKeyPrefix, query],
    queryFn: () => buscar(query),
  });

  const items: ComboItem[] = (candidatos ?? []).map((c) => ({ key: c.codigo, code: c.codigo, description: c.descricao, ...c }));

  const quantidadeNumero = Number(quantidade.replace(',', '.'));
  const quantidadeValida = Number.isFinite(quantidadeNumero) && quantidadeNumero > 0;

  const addMutation = useMutation({
    mutationFn: () => onAdicionar(selecionado!.codigo, quantidadeNumero),
    onSuccess: () => {
      setSelecionado(null);
      setQuantidade('1');
      setErro(null);
      comboRef.current?.focus();
    },
    onError: (err) => setErro(err instanceof Error ? err.message : 'Não foi possível adicionar.'),
  });

  function handleSelecionar(item: ComboItem) {
    setSelecionado(item);
    setErro(null);
    requestAnimationFrame(() => {
      qtdRef.current?.focus();
      qtdRef.current?.select();
    });
  }

  function handleQuantidadeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (quantidadeValida) addMutation.mutate();
    } else if (e.key === 'Escape') {
      cancelarSelecao();
    }
  }

  function cancelarSelecao() {
    setSelecionado(null);
    setErro(null);
    comboRef.current?.focus();
  }

  const colCount = 4 + (mostrarPreco ? 2 : 0) + (podeEditar ? 1 : 0);
  const totalPrevia =
    selecionado?.precoUnitario !== undefined && quantidadeValida ? selecionado.precoUnitario * quantidadeNumero : undefined;

  return (
    <div className={styles.wrapper}>
      {/* Desktop */}
      <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Código</th>
            <th>Descrição</th>
            <th>Un.</th>
            <th className={styles.right}>Qtd.</th>
            {mostrarPreco && <th className={styles.right}>Preço unit.</th>}
            {mostrarPreco && <th className={styles.right}>Total</th>}
            {podeEditar && <th aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {itens.length === 0 && (
            <tr>
              <td colSpan={colCount} className={styles.emptyCell}>
                {vazio}
              </td>
            </tr>
          )}
          {itens.map((item) => (
            <tr key={item.codigo}>
              <td className={styles.mono}>{item.codigo}</td>
              <td>{item.descricao}</td>
              <td>{item.unidade}</td>
              <td className={`${styles.right} ${styles.mono}`}>{item.quantidade}</td>
              {mostrarPreco && (
                <td className={`${styles.right} ${styles.mono}`}>
                  {item.precoUnitario !== undefined ? `R$ ${item.precoUnitario.toFixed(2)}` : '—'}
                </td>
              )}
              {mostrarPreco && (
                <td className={`${styles.right} ${styles.mono}`}>{item.total !== undefined ? `R$ ${item.total.toFixed(2)}` : '—'}</td>
              )}
              {podeEditar && (
                <td className={styles.right}>
                  <button
                    type="button"
                    className={styles.trashButton}
                    aria-label={`Remover ${item.descricao}`}
                    onClick={() => onRemover(item)}
                  >
                    🗑
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Mobile */}
      <div className={styles.cardList}>
        {itens.length === 0 && <p className={styles.emptyCell}>{vazio}</p>}
        {itens.map((item) => (
          <div key={item.codigo} className={styles.itemCard}>
            <div className={styles.itemCardMain}>
              <div className={styles.itemCardDescricao}>{item.descricao}</div>
              <div className={styles.itemCardMeta}>
                <span className={styles.mono}>{item.codigo}</span> · {item.unidade} · qtd <span className={styles.mono}>{item.quantidade}</span>
              </div>
              {mostrarPreco && (item.precoUnitario !== undefined || item.total !== undefined) && (
                <div className={`${styles.itemCardMeta} ${styles.mono}`}>
                  {item.precoUnitario !== undefined && `R$ ${item.precoUnitario.toFixed(2)} un.`}
                  {item.total !== undefined && ` · Total R$ ${item.total.toFixed(2)}`}
                </div>
              )}
            </div>
            {podeEditar && (
              <button
                type="button"
                className={styles.trashButton}
                aria-label={`Remover ${item.descricao}`}
                onClick={() => onRemover(item)}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Controles de adicionar — um só bloco, reflui via CSS pro desktop/mobile */}
      {podeEditar && (
        <div className={styles.addControls}>
          <div className={styles.addSearch}>
            <SearchCombobox<ComboItem>
              ref={comboRef}
              placeholder={placeholder}
              items={selecionado ? [] : items}
              isLoading={isFetching}
              isError={isError}
              onQueryChange={setQuery}
              onSelect={handleSelecionar}
              renderItem={(item) => (
                <>
                  <span>
                    {item.descricao} <small style={{ color: 'var(--color-text-secondary)' }}>({item.unidade})</small>
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {item.codigo}
                    {item.precoUnitario !== undefined && ` · R$ ${item.precoUnitario.toFixed(2)}`}
                  </span>
                </>
              )}
            />
          </div>

          <div className={styles.addQty}>
            <span className={styles.addQtyUnidade}>{selecionado?.unidade ?? '—'}</span>
            <input
              ref={qtdRef}
              type="text"
              inputMode="decimal"
              className={styles.qtyInput}
              value={quantidade}
              disabled={!selecionado || addMutation.isPending}
              onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={handleQuantidadeKeyDown}
              aria-label="Quantidade"
            />
            {mostrarPreco && selecionado && (
              <span className={`${styles.addQtyPreco} ${styles.mono}`}>
                {selecionado.precoUnitario !== undefined ? `R$ ${selecionado.precoUnitario.toFixed(2)}` : '—'}
                {totalPrevia !== undefined && ` · Total R$ ${totalPrevia.toFixed(2)}`}
              </span>
            )}
            {selecionado && (
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={() => addMutation.mutate()}
                  disabled={!quantidadeValida || addMutation.isPending}
                  aria-label="Confirmar item (Enter)"
                >
                  ✓
                </button>
                <button type="button" className={styles.cancelButton} onClick={cancelarSelecao} aria-label="Cancelar seleção (Esc)">
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className={styles.errorText}>
          {erro}
        </p>
      )}
    </div>
  );
}
