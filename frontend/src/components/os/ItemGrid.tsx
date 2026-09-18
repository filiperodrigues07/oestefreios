import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { Input } from '../ui/Input.js';
import { SearchCombobox, type SearchComboboxHandle, type SearchComboboxItem } from '../ui/SearchCombobox.js';
import styles from './ItemGrid.module.css';

export interface ItemGridRow {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario?: number;
  total?: number;
  /** Texto livre que só o cliente preenche no lançamento (DESCRCOMPLEMENT). */
  descricaoComplementar?: string;
}

export interface ItemGridCandidate {
  codigo: string;
  descricao: string;
  unidade: string;
  precoUnitario?: number;
}

type ComboItem = ItemGridCandidate & SearchComboboxItem;
type ItemPatch = { quantidade?: number; precoUnitario?: number; descricaoComplementar?: string };

interface ItemGridProps {
  itens: ItemGridRow[];
  queryKeyPrefix: string;
  buscar: (query: string) => Promise<ItemGridCandidate[]>;
  /** Busca exata por código (Enter no campo Código) — retorna `null` quando não existe. */
  buscarPorCodigo: (codigo: string) => Promise<ItemGridCandidate | null>;
  onAdicionar: (codigo: string, quantidade: number, precoUnitario?: number, descricaoComplementar?: string) => Promise<unknown>;
  /** Editar quantidade/preço de um item já lançado (também usado pra somar quantidade em item duplicado). */
  onAtualizar: (codigo: string, patch: ItemPatch) => Promise<unknown>;
  onRemover: (row: ItemGridRow) => void;
  podeEditar: boolean;
  mostrarPreco: boolean;
  /** Só quem tem FINANCIAL_EDIT pode ajustar o preço unitário antes de confirmar (backend revalida). */
  podeEditarPreco: boolean;
  vazio: string;
  placeholder: string;
}

/**
 * Grid de lançamento inline — controles de adicionar ficam no topo (código exato com Enter,
 * ou descrição com autocomplete/F8), a lista de itens já lançados cresce abaixo, sem sair da
 * tela nem abrir modal por item. Desktop mostra tabela, mobile mostra lista de cards — mesmo
 * estado, mesmos handlers, só o markup de exibição dos itens muda por CSS. Item já lançado de
 * novo pergunta se quer somar a quantidade em vez de bloquear; cada linha pode ser editada
 * depois (ícone de lápis) sem precisar remover e relançar.
 */
export function ItemGrid({
  itens,
  queryKeyPrefix,
  buscar,
  buscarPorCodigo,
  onAdicionar,
  onAtualizar,
  onRemover,
  podeEditar,
  mostrarPreco,
  podeEditarPreco,
  vazio,
  placeholder,
}: ItemGridProps) {
  const [query, setQuery] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [selecionado, setSelecionado] = useState<ItemGridCandidate | null>(null);
  const [quantidade, setQuantidade] = useState('1');
  const [precoEditado, setPrecoEditado] = useState('');
  const [complemento, setComplemento] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<{ existente: ItemGridRow; novaQuantidade: number } | null>(null);
  const [editandoCodigo, setEditandoCodigo] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState('');
  const [editPreco, setEditPreco] = useState('');
  const [editComplemento, setEditComplemento] = useState('');
  const comboRef = useRef<SearchComboboxHandle>(null);
  const qtdRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  const { data: candidatos, isFetching, isError } = useQuery({
    queryKey: [queryKeyPrefix, query],
    queryFn: () => buscar(query),
  });

  const items: ComboItem[] = (candidatos ?? []).map((c) => ({ key: c.codigo, code: c.codigo, description: c.descricao, ...c }));

  const quantidadeNumero = Number(quantidade.replace(',', '.'));
  const quantidadeValida = Number.isFinite(quantidadeNumero) && quantidadeNumero > 0;
  const precoEditadoNumero = Number(precoEditado.replace(',', '.'));
  const precoEditadoValido = Number.isFinite(precoEditadoNumero) && precoEditadoNumero >= 0;

  useEffect(() => {
    if (selecionado && podeEditarPreco) {
      setPrecoEditado(selecionado.precoUnitario !== undefined ? selecionado.precoUnitario.toFixed(2) : '');
    }
  }, [selecionado, podeEditarPreco]);

  const codigoMutation = useMutation({
    mutationFn: (codigo: string) => buscarPorCodigo(codigo),
    onSuccess: (candidate) => {
      if (candidate) {
        handleSelecionar(candidate);
        setCodigoInput('');
      } else {
        setErro(`Código "${codigoInput.trim()}" não encontrado.`);
      }
    },
    onError: (err) => setErro(err instanceof Error ? err.message : 'Não foi possível buscar o código.'),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      onAdicionar(
        selecionado!.codigo,
        quantidadeNumero,
        podeEditarPreco && precoEditadoValido ? precoEditadoNumero : undefined,
        complemento.trim() || undefined,
      ),
    onSuccess: () => resetarAdicao(),
    onError: (err) => setErro(err instanceof Error ? err.message : 'Não foi possível adicionar.'),
  });

  const somarDuplicadoMutation = useMutation({
    mutationFn: () => onAtualizar(duplicado!.existente.codigo, { quantidade: duplicado!.existente.quantidade + duplicado!.novaQuantidade }),
    onSuccess: () => {
      setDuplicado(null);
      resetarAdicao();
    },
    onError: (err) => {
      setDuplicado(null);
      setErro(err instanceof Error ? err.message : 'Não foi possível atualizar a quantidade.');
    },
  });

  const editMutation = useMutation({
    mutationFn: (codigo: string) => {
      const qtd = Number(editQtd.replace(',', '.'));
      const preco = Number(editPreco.replace(',', '.'));
      const patch: ItemPatch = { descricaoComplementar: editComplemento.trim() };
      if (Number.isFinite(qtd) && qtd > 0) patch.quantidade = qtd;
      if (podeEditarPreco && Number.isFinite(preco) && preco >= 0) patch.precoUnitario = preco;
      return onAtualizar(codigo, patch);
    },
    onSuccess: () => setEditandoCodigo(null),
    onError: (err) => setErro(err instanceof Error ? err.message : 'Não foi possível salvar a edição.'),
  });

  function resetarAdicao() {
    setSelecionado(null);
    setQuantidade('1');
    setPrecoEditado('');
    setComplemento('');
    setErro(null);
    codigoRef.current?.focus();
  }

  function handleSelecionar(item: ItemGridCandidate) {
    setSelecionado(item);
    setErro(null);
    requestAnimationFrame(() => {
      qtdRef.current?.focus();
      qtdRef.current?.select();
    });
  }

  function handleConfirmarAdicao() {
    const existente = itens.find((i) => i.codigo === selecionado!.codigo);
    if (existente) {
      setDuplicado({ existente, novaQuantidade: quantidadeNumero });
      return;
    }
    addMutation.mutate();
  }

  function handleCodigoKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const codigo = codigoInput.trim();
      if (codigo.length > 0) codigoMutation.mutate(codigo);
    }
  }

  function handleQuantidadeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (quantidadeValida) handleConfirmarAdicao();
    } else if (e.key === 'Escape') {
      cancelarSelecao();
    }
  }

  function cancelarSelecao() {
    setSelecionado(null);
    setPrecoEditado('');
    setErro(null);
    codigoRef.current?.focus();
  }

  function iniciarEdicaoLinha(item: ItemGridRow) {
    setEditandoCodigo(item.codigo);
    setEditQtd(String(item.quantidade));
    setEditPreco(item.precoUnitario !== undefined ? item.precoUnitario.toFixed(2) : '');
    setEditComplemento(item.descricaoComplementar ?? '');
    setErro(null);
  }

  const colCount = 4 + (mostrarPreco ? 2 : 0) + (podeEditar ? 1 : 0);
  const totalPrevia =
    quantidadeValida && (podeEditarPreco ? precoEditadoValido : selecionado?.precoUnitario !== undefined)
      ? (podeEditarPreco ? precoEditadoNumero : selecionado!.precoUnitario!) * quantidadeNumero
      : undefined;

  return (
    <div className={styles.wrapper}>
      {/* Controles de adicionar — no topo, pra lista de itens crescer abaixo conforme lança */}
      {podeEditar && (
        <div className={styles.addControls}>
          <div className={styles.addCodigo}>
            <Input
              ref={codigoRef}
              label="Código"
              type="text"
              className={styles.codigoInput}
              placeholder="Código exato + Enter"
              value={selecionado ? selecionado.codigo : codigoInput}
              disabled={!!selecionado || codigoMutation.isPending}
              onChange={(e) => setCodigoInput(e.target.value)}
              onKeyDown={handleCodigoKeyDown}
            />
          </div>

          <div className={styles.addSearch}>
            {selecionado ? (
              <Input label="Descrição" type="text" value={selecionado.descricao} disabled />
            ) : (
              <SearchCombobox<ComboItem>
                ref={comboRef}
                label="Descrição"
                placeholder={placeholder}
                items={items}
                isLoading={isFetching}
                isError={isError}
                onQueryChange={setQuery}
                onSelect={handleSelecionar}
                renderItem={(item) => (
                  <>
                    <span>
                      {item.descricao} <small style={{ color: 'var(--color-text-secondary)' }}>({item.unidade})</small>
                    </span>
                    <span className={`${styles.optionMeta} ${styles.mono}`}>
                      {item.codigo}
                      {item.precoUnitario !== undefined && ` · R$ ${item.precoUnitario.toFixed(2)}`}
                    </span>
                  </>
                )}
              />
            )}
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
            {mostrarPreco && selecionado && podeEditarPreco && (
              <input
                type="text"
                inputMode="decimal"
                className={`${styles.priceInput} ${styles.mono}`}
                value={precoEditado}
                disabled={addMutation.isPending}
                onChange={(e) => setPrecoEditado(e.target.value)}
                onKeyDown={handleQuantidadeKeyDown}
                aria-label="Preço unitário"
              />
            )}
            {mostrarPreco && selecionado && !podeEditarPreco && (
              <span className={`${styles.addQtyPreco} ${styles.mono}`}>
                {selecionado.precoUnitario !== undefined ? `R$ ${selecionado.precoUnitario.toFixed(2)}` : '—'}
              </span>
            )}
            {mostrarPreco && selecionado && totalPrevia !== undefined && (
              <span className={`${styles.addQtyPreco} ${styles.mono}`}>Total R$ {totalPrevia.toFixed(2)}</span>
            )}
            {selecionado && (
              <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center' }}>
                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={handleConfirmarAdicao}
                  disabled={!quantidadeValida || (podeEditarPreco && !precoEditadoValido) || addMutation.isPending}
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

          {selecionado && (
            <div className={styles.addComplemento}>
              <input
                type="text"
                className={styles.complementoInput}
                placeholder="Complemento (opcional)"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                disabled={addMutation.isPending}
                aria-label="Complemento"
              />
            </div>
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className={styles.errorText}>
          {erro}
        </p>
      )}

      {/* Desktop */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Un.</th>
              <th className={styles.center}>Qtd.</th>
              {mostrarPreco && <th className={styles.center}>Preço unit.</th>}
              {mostrarPreco && <th className={styles.center}>Total</th>}
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
            {itens.map((item) => {
              const emEdicao = editandoCodigo === item.codigo;
              return (
                <tr key={item.codigo}>
                  <td className={styles.mono}>{item.codigo}</td>
                  <td>
                    {item.descricao}
                    {emEdicao ? (
                      <input
                        type="text"
                        className={styles.complementoInput}
                        placeholder="Complemento (opcional)"
                        value={editComplemento}
                        onChange={(e) => setEditComplemento(e.target.value)}
                        aria-label="Editar complemento"
                        style={{ marginTop: 'var(--space-1)' }}
                      />
                    ) : (
                      item.descricaoComplementar && <div className={styles.complementoTexto}>{item.descricaoComplementar}</div>
                    )}
                  </td>
                  <td>{item.unidade}</td>
                  <td className={`${styles.center} ${styles.mono}`}>
                    {emEdicao ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className={styles.qtyInput}
                        value={editQtd}
                        onChange={(e) => setEditQtd(e.target.value)}
                        aria-label="Editar quantidade"
                      />
                    ) : (
                      item.quantidade
                    )}
                  </td>
                  {mostrarPreco && (
                    <td className={`${styles.center} ${styles.mono}`}>
                      {emEdicao && podeEditarPreco ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          className={styles.priceInput}
                          value={editPreco}
                          onChange={(e) => setEditPreco(e.target.value)}
                          aria-label="Editar preço unitário"
                        />
                      ) : item.precoUnitario !== undefined ? (
                        `R$ ${item.precoUnitario.toFixed(2)}`
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  {mostrarPreco && (
                    <td className={`${styles.center} ${styles.mono}`}>{item.total !== undefined ? `R$ ${item.total.toFixed(2)}` : '—'}</td>
                  )}
                  {podeEditar && (
                    <td className={styles.center}>
                      {emEdicao ? (
                        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className={styles.confirmButton}
                            onClick={() => editMutation.mutate(item.codigo)}
                            disabled={editMutation.isPending}
                            aria-label={`Salvar ${item.descricao}`}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={() => setEditandoCodigo(null)}
                            aria-label="Cancelar edição"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className={styles.editItemButton}
                            aria-label={`Editar ${item.descricao}`}
                            onClick={() => iniciarEdicaoLinha(item)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className={styles.trashButton}
                            aria-label={`Remover ${item.descricao}`}
                            onClick={() => onRemover(item)}
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className={styles.cardList}>
        {itens.length === 0 && <p className={styles.emptyCell}>{vazio}</p>}
        {itens.map((item) => {
          const emEdicao = editandoCodigo === item.codigo;
          return (
            <div key={item.codigo} className={styles.itemCard}>
              <div className={styles.itemCardMain}>
                <div className={styles.itemCardDescricao}>{item.descricao}</div>
                {emEdicao ? (
                  <div className={styles.addQty} style={{ padding: 0 }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={styles.qtyInput}
                      value={editQtd}
                      onChange={(e) => setEditQtd(e.target.value)}
                      aria-label="Editar quantidade"
                    />
                    {podeEditarPreco && (
                      <input
                        type="text"
                        inputMode="decimal"
                        className={styles.priceInput}
                        value={editPreco}
                        onChange={(e) => setEditPreco(e.target.value)}
                        aria-label="Editar preço unitário"
                      />
                    )}
                    <input
                      type="text"
                      className={styles.complementoInput}
                      placeholder="Complemento (opcional)"
                      value={editComplemento}
                      onChange={(e) => setEditComplemento(e.target.value)}
                      aria-label="Editar complemento"
                    />
                  </div>
                ) : (
                  <>
                    <div className={styles.itemCardMeta}>
                      <span className={styles.mono}>{item.codigo}</span> · {item.unidade} · qtd{' '}
                      <span className={styles.mono}>{item.quantidade}</span>
                    </div>
                    {item.descricaoComplementar && <div className={styles.complementoTexto}>{item.descricaoComplementar}</div>}
                    {mostrarPreco && (item.precoUnitario !== undefined || item.total !== undefined) && (
                      <div className={`${styles.itemCardMeta} ${styles.mono}`}>
                        {item.precoUnitario !== undefined && `R$ ${item.precoUnitario.toFixed(2)} un.`}
                        {item.total !== undefined && ` · Total R$ ${item.total.toFixed(2)}`}
                      </div>
                    )}
                  </>
                )}
              </div>
              {podeEditar && (
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  {emEdicao ? (
                    <>
                      <button
                        type="button"
                        className={styles.confirmButton}
                        onClick={() => editMutation.mutate(item.codigo)}
                        disabled={editMutation.isPending}
                        aria-label={`Salvar ${item.descricao}`}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className={styles.cancelButton}
                        onClick={() => setEditandoCodigo(null)}
                        aria-label="Cancelar edição"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.editItemButton}
                        aria-label={`Editar ${item.descricao}`}
                        onClick={() => iniciarEdicaoLinha(item)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className={styles.trashButton}
                        aria-label={`Remover ${item.descricao}`}
                        onClick={() => onRemover(item)}
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={duplicado !== null}
        title="Item já lançado"
        description={
          duplicado
            ? `"${duplicado.existente.descricao}" já está nesta OS com quantidade ${duplicado.existente.quantidade}. Deseja somar mais ${duplicado.novaQuantidade} (total ${duplicado.existente.quantidade + duplicado.novaQuantidade})?`
            : ''
        }
        confirmLabel="Somar quantidade"
        loading={somarDuplicadoMutation.isPending}
        onCancel={() => setDuplicado(null)}
        onConfirm={() => somarDuplicadoMutation.mutate()}
      />
    </div>
  );
}
