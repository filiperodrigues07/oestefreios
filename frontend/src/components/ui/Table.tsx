import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  applyOrder,
  clampWidth,
  clearPrefs,
  hasCustomPrefs,
  loadPrefs,
  MIN_COLUMN_WIDTH,
  savePrefs,
  type ColumnPrefs,
} from './columnLayout.js';
import styles from './Table.module.css';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Números/códigos — usa --font-mono com tabular-nums pra colunas alinharem. */
  mono?: boolean;
  sortable?: boolean;
  /** Largura fixa (ex. "132px") — evita a coluna "pular" de tamanho conforme o conteúdo de cada linha. */
  width?: string;
  /** Coluna travada (ex.: Ações): fica sempre no fim, visível ao rolar, sem redimensionar nem reordenar. Padrão: colunas de ações. */
  locked?: boolean;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
  /** Chave única (por tela) — liga redimensionar/reordenar colunas tipo planilha, persistido no navegador. */
  columnPrefsKey?: string;
  /** Conteúdo resumido do cartão no mobile. O desktop continua usando as colunas da tabela. */
  renderMobileCard?: (row: T) => ReactNode;
}

const EMPTY_PREFS: ColumnPrefs = { order: [], widths: {} };
const AUTO_COLUMN_MIN = 120;
const STEP = 8;
const STEP_LARGE = 32;

/** Cliques que pertencem a um controle dentro da linha (botão, link, campo) não abrem o cadastro. */
const INTERACTIVE = 'a, button, input, select, textarea, label, [data-row-action]';

/** Colunas de ações não mexem: ficam no fim, coladas à direita, com a largura que a tela declara. */
function travada<T>(col: TableColumn<T>): boolean {
  return col.locked ?? (col.key === 'acoes' || col.key === 'actions' || col.header === '' || col.header === 'Ações');
}

/** Dados curtos (código, documento, telefone, ações) nunca quebram linha: aparecem inteiros por padrão. */
function semQuebra<T>(col: TableColumn<T>): boolean {
  return Boolean(col.mono || col.width || travada(col));
}

function larguraPadrao(width?: string): number | undefined {
  const parsed = width ? parseInt(width, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Tabela genérica (cabeçalho fixo, coluna ordenável por clique, linha com hover/clique) —
 * base compartilhada por Produtos, Clientes, Veículos, OS e Usuários. Com `columnPrefsKey`, também permite
 * redimensionar (arrastar a borda do cabeçalho) e reordenar colunas (arrastar o cabeçalho) tipo planilha,
 * lembrando por navegador via localStorage — nunca sincroniza entre dispositivos/usuários.
 *
 * Redimensionar: enquanto ninguém mexeu nas larguras, a tabela usa o layout automático do navegador (como
 * sempre foi). No primeiro ajuste as larguras atuais são "congeladas" (nada pula) e a tabela passa a
 * `table-layout: fixed`: mexer numa coluna não empurra nem encolhe as outras. Durante o arraste a largura
 * vai direto no <col> (sem re-render das linhas) e só é gravada ao soltar.
 */
export function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  sortBy,
  sortOrder,
  onSortChange,
  columnPrefsKey,
  renderMobileCard,
}: TableProps<T>) {
  const [prefs, setPrefs] = useState<ColumnPrefs>(() => (columnPrefsKey ? (loadPrefs(columnPrefsKey) ?? EMPTY_PREFS) : EMPTY_PREFS));
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const dragKey = useRef<string | null>(null);
  const resizeAtivo = useRef(false);
  const ultimoToqueNaAlca = useRef<{ key: string; em: number } | null>(null);

  // Troca de tela/aba com outra chave: recarrega a preferência daquela tabela.
  const chaveCarregada = useRef(columnPrefsKey);
  useEffect(() => {
    if (chaveCarregada.current === columnPrefsKey) return;
    chaveCarregada.current = columnPrefsKey;
    setPrefs(columnPrefsKey ? (loadPrefs(columnPrefsKey) ?? EMPTY_PREFS) : EMPTY_PREFS);
  }, [columnPrefsKey]);

  const displayColumns = useMemo(() => {
    const moveis = columns.filter((col) => !travada(col));
    return [...applyOrder(moveis, prefs.order), ...columns.filter((col) => travada(col))];
  }, [columns, prefs.order]);
  const widths = prefs.widths;
  const fixed = Boolean(columnPrefsKey) && displayColumns.some((col) => widths[col.key] !== undefined);
  const larguraDaColuna = (col: TableColumn<T>): number | undefined =>
    fixed ? (widths[col.key] ?? larguraPadrao(col.width)) : undefined;
  const somaExplicita = displayColumns.reduce((soma, col) => soma + (larguraDaColuna(col) ?? AUTO_COLUMN_MIN), 0);
  const temColunaElastica = displayColumns.some((col) => larguraDaColuna(col) === undefined);

  function persistir(proximo: ColumnPrefs) {
    setPrefs(proximo);
    if (columnPrefsKey) savePrefs(columnPrefsKey, proximo);
  }

  function restaurarColunas() {
    if (columnPrefsKey) clearPrefs(columnPrefsKey);
    setPrefs(EMPTY_PREFS);
  }

  /** Mede todas as colunas hoje na tela e as grava como larguras explícitas, sem nada mudar de tamanho. */
  function congelarLarguras() {
    if (fixed || !tableRef.current) return;
    const medidas: Record<string, number> = {};
    tableRef.current.querySelectorAll<HTMLElement>('thead th[data-col]').forEach((th) => {
      medidas[th.dataset.col!] = clampWidth(th.getBoundingClientRect().width);
    });
    flushSync(() => setPrefs((atual) => ({ ...atual, widths: { ...medidas, ...atual.widths } })));
  }

  function atualizarLarguraDaTabela() {
    const tabela = tableRef.current;
    if (!tabela) return;
    let soma = 0;
    for (const col of displayColumns) {
      const el = colRefs.current[col.key];
      soma += parseFloat(el?.style.width ?? '') || AUTO_COLUMN_MIN;
    }
    tabela.style.width = `max(100%, ${soma}px)`;
  }

  function definirLargura(col: TableColumn<T>, largura: number) {
    const atual = prefsRef.current;
    persistir({ order: atual.order, widths: { ...atual.widths, [col.key]: clampWidth(largura) } });
  }

  function iniciarRedimensionamento(event: PointerEvent<HTMLSpanElement>, col: TableColumn<T>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    // Duplo clique/toque: pointerdown com preventDefault suprime o "dblclick" nativo, então detecta na mão.
    const agora = performance.now();
    const anterior = ultimoToqueNaAlca.current;
    if (anterior && anterior.key === col.key && agora - anterior.em < 400) {
      ultimoToqueNaAlca.current = null;
      ajustarAoConteudo(col, displayColumns.indexOf(col));
      return;
    }
    ultimoToqueNaAlca.current = { key: col.key, em: agora };

    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    resizeAtivo.current = true;
    const xInicial = event.clientX;
    const guia = guideRef.current;
    let preparado = false;
    let colEl: HTMLTableColElement | null | undefined;
    let larguraInicial = 0;
    let esquerdaInicial = 0;
    let proxima = 0;
    let quadro = 0;

    // Só mexe na tabela quando o ponteiro realmente se move: um clique simples na alça não muda nada.
    const preparar = (): boolean => {
      congelarLarguras();
      const th = handle.closest('th');
      const wrapper = wrapperRef.current;
      colEl = colRefs.current[col.key];
      if (!th || !wrapper || !colEl) return false;
      larguraInicial = th.getBoundingClientRect().width;
      proxima = larguraInicial;
      esquerdaInicial = th.getBoundingClientRect().left - wrapper.getBoundingClientRect().left + wrapper.scrollLeft;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      if (guia) guia.style.display = 'block';
      return true;
    };
    const aplicar = () => {
      quadro = 0;
      if (!colEl) return;
      colEl.style.width = `${proxima}px`;
      atualizarLarguraDaTabela();
      if (guia) guia.style.transform = `translateX(${esquerdaInicial + proxima}px)`;
    };
    const limpar = () => {
      handle.removeEventListener('pointermove', mover);
      handle.removeEventListener('pointerup', terminar);
      handle.removeEventListener('pointercancel', terminar);
      if (quadro) cancelAnimationFrame(quadro);
      if (guia) guia.style.display = 'none';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizeAtivo.current = false;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
    function mover(ev: globalThis.PointerEvent) {
      if (!preparado) {
        if (Math.abs(ev.clientX - xInicial) < 3) return;
        preparado = preparar();
        if (!preparado) {
          limpar();
          return;
        }
      }
      proxima = clampWidth(larguraInicial + ev.clientX - xInicial);
      if (!quadro) quadro = requestAnimationFrame(aplicar);
    }
    function terminar() {
      limpar();
      if (!preparado) return;
      aplicar();
      definirLargura(col, proxima);
    }

    handle.addEventListener('pointermove', mover);
    handle.addEventListener('pointerup', terminar);
    handle.addEventListener('pointercancel', terminar);
  }

  /** Mede o maior conteúdo da coluna (cabeçalho + células) e ajusta a largura a ele. */
  function ajustarAoConteudo(col: TableColumn<T>, indice: number) {
    congelarLarguras();
    const tabela = tableRef.current;
    const colEl = colRefs.current[col.key];
    if (!tabela || !colEl) return;
    const anterior = colEl.style.width;
    colEl.style.width = `${MIN_COLUMN_WIDTH}px`;
    const celulas = [
      tabela.querySelector<HTMLElement>(`thead th:nth-child(${indice + 1})`),
      ...tabela.querySelectorAll<HTMLElement>(`tbody tr > td:nth-child(${indice + 1})`),
    ].filter((el): el is HTMLElement => el !== null);
    let maior = MIN_COLUMN_WIDTH;
    for (const celula of celulas) {
      const antes = celula.style.whiteSpace;
      celula.style.whiteSpace = 'nowrap';
      const padding = parseFloat(getComputedStyle(celula).paddingRight) || 0;
      maior = Math.max(maior, celula.scrollWidth + padding + 2);
      celula.style.whiteSpace = antes;
    }
    colEl.style.width = anterior;
    definirLargura(col, maior);
  }

  function restaurarColuna(col: TableColumn<T>, indice: number) {
    const padrao = larguraPadrao(col.width);
    if (padrao !== undefined) {
      congelarLarguras();
      definirLargura(col, padrao);
    } else {
      ajustarAoConteudo(col, indice);
    }
  }

  function aoTeclarNaAlca(event: KeyboardEvent<HTMLSpanElement>, col: TableColumn<T>, indice: number) {
    const passo = event.shiftKey ? STEP_LARGE : STEP;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      congelarLarguras();
      const atual = prefsRef.current.widths[col.key] ?? larguraPadrao(col.width) ?? AUTO_COLUMN_MIN;
      definirLargura(col, atual + (event.key === 'ArrowRight' ? passo : -passo));
    } else if (event.key === 'Home') {
      event.preventDefault();
      restaurarColuna(col, indice);
    }
  }

  function aoComecarArrastarColuna(event: DragEvent<HTMLTableCellElement>, key: string) {
    if (!columnPrefsKey || resizeAtivo.current) {
      event.preventDefault();
      return;
    }
    dragKey.current = key;
    event.dataTransfer.effectAllowed = 'move';
    // Firefox só inicia o arraste se algum dado for definido.
    event.dataTransfer.setData('text/plain', key);
  }

  function aoSoltarColuna(targetKey: string) {
    setDragOverKey(null);
    if (!columnPrefsKey || !dragKey.current || dragKey.current === targetKey) return;
    const atual = displayColumns.filter((c) => !travada(c)).map((c) => c.key);
    const de = atual.indexOf(dragKey.current);
    const para = atual.indexOf(targetKey);
    dragKey.current = null;
    if (de === -1 || para === -1) return;
    const proxima = [...atual];
    proxima.splice(de, 1);
    proxima.splice(para, 0, atual[de]!);
    persistir({ order: proxima, widths: prefsRef.current.widths });
  }

  function aoClicarNaLinha(row: T, event: MouseEvent<HTMLElement>) {
    if (!onRowClick) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    // Quem está selecionando texto (copiar CNPJ, telefone...) não quer abrir o cadastro.
    const selecao = window.getSelection();
    if (selecao && !selecao.isCollapsed && selecao.anchorNode && event.currentTarget.contains(selecao.anchorNode)) return;
    onRowClick(row);
  }

  // Mobile: mesma coluna "ações" (header vazio, cheia de botões) vira um rodapé de card em vez
  // de mais uma linha rotulada — o resto das colunas vira par rótulo/valor, sem precisar que cada
  // tela (OS/Clientes/Produtos) declare nada a mais pra ganhar o modo cartão.
  const actionColumn = displayColumns.find((col) => col.header === '');
  const fieldColumns = displayColumns.filter((col) => col.header !== '');

  return (
    <div className={styles.root}>
      {columnPrefsKey && hasCustomPrefs(prefs) && (
        <div className={styles.toolbar}>
          <button type="button" className={styles.resetButton} onClick={restaurarColunas}>
            Restaurar colunas
          </button>
        </div>
      )}
      <div className={styles.wrapper} ref={wrapperRef}>
        <div className={styles.cardList}>
          {data.map((row) => (
            <div
              key={rowKey(row)}
              className={[styles.card, onRowClick ? styles.cardClickable : ''].filter(Boolean).join(' ')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {renderMobileCard ? (
                renderMobileCard(row)
              ) : (
                <>
                  {fieldColumns.map((col) => (
                    <div key={col.key} className={styles.cardField}>
                      <span className={styles.cardLabel}>{col.header}</span>
                      <span className={[styles.cardValue, col.mono ? styles.mono : ''].filter(Boolean).join(' ')}>
                        {col.render(row)}
                      </span>
                    </div>
                  ))}
                  {actionColumn && <div className={styles.cardActions}>{actionColumn.render(row)}</div>}
                </>
              )}
            </div>
          ))}
        </div>
        <table
          ref={tableRef}
          className={[styles.table, fixed ? styles.fixed : ''].filter(Boolean).join(' ')}
          style={fixed ? { width: `max(100%, ${somaExplicita}px)` } : undefined}
        >
          {fixed && (
            <colgroup>
              {displayColumns.map((col) => {
                const largura = larguraDaColuna(col);
                return (
                  <col
                    key={col.key}
                    ref={(el) => {
                      colRefs.current[col.key] = el;
                    }}
                    style={largura !== undefined ? { width: `${largura}px` } : undefined}
                  />
                );
              })}
              {!temColunaElastica && <col />}
            </colgroup>
          )}
          <thead>
            <tr>
              {displayColumns.map((col, indice) => {
                const isSorted = sortBy === col.key;
                const clickable = col.sortable && onSortChange;
                const bloqueada = travada(col);
                return (
                  <th
                    key={col.key}
                    data-col={col.key}
                    draggable={Boolean(columnPrefsKey) && !bloqueada}
                    onDragStart={(event) => aoComecarArrastarColuna(event, col.key)}
                    onDragOver={(event) => {
                      if (!columnPrefsKey || !dragKey.current || bloqueada) return;
                      event.preventDefault();
                      setDragOverKey(col.key);
                    }}
                    onDragLeave={() => setDragOverKey((atual) => (atual === col.key ? null : atual))}
                    onDragEnd={() => setDragOverKey(null)}
                    onDrop={() => aoSoltarColuna(col.key)}
                    className={[
                      styles.th,
                      col.align === 'right' ? styles.alignRight : '',
                      clickable ? styles.sortable : '',
                      columnPrefsKey && !bloqueada ? styles.thDraggable : '',
                      dragOverKey === col.key ? styles.thDragOver : '',
                      bloqueada ? styles.lockedCell : '',
                      semQuebra(col) ? styles.nowrap : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={!fixed && col.width ? { width: col.width } : undefined}
                    aria-sort={isSorted ? (sortOrder === 'desc' ? 'descending' : 'ascending') : undefined}
                  >
                    {clickable ? (
                      <button type="button" className={styles.thButton} onClick={() => onSortChange(col.key)}>
                        {col.header}
                        <span className={styles.sortIcon} aria-hidden="true">
                          {isSorted ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                        </span>
                      </button>
                    ) : (
                      <span className={styles.thContent}>{col.header}</span>
                    )}
                    {columnPrefsKey && !bloqueada && (
                      <span
                        className={styles.resizeHandle}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Largura da coluna ${col.header || 'ações'}`}
                        aria-valuemin={MIN_COLUMN_WIDTH}
                        aria-valuenow={widths[col.key]}
                        tabIndex={0}
                        draggable={false}
                        title="Arraste para ajustar a largura. Duplo clique ajusta ao conteúdo."
                        onPointerDown={(event) => iniciarRedimensionamento(event, col)}
                        onKeyDown={(event) => aoTeclarNaAlca(event, col, indice)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    )}
                  </th>
                );
              })}
              {fixed && !temColunaElastica && <th className={styles.th} aria-hidden="true" />}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? styles.rowClickable : ''}
                onClick={onRowClick ? (event) => aoClicarNaLinha(row, event) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {displayColumns.map((col) => {
                  const conteudo = col.render(row);
                  return (
                    <td
                      key={col.key}
                      title={fixed && (typeof conteudo === 'string' || typeof conteudo === 'number') ? String(conteudo) : undefined}
                      className={[
                        styles.td,
                        col.align === 'right' ? styles.alignRight : '',
                        col.mono ? styles.mono : '',
                        travada(col) ? styles.lockedCell : '',
                        semQuebra(col) ? styles.nowrap : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {conteudo}
                    </td>
                  );
                })}
                {fixed && !temColunaElastica && <td className={styles.td} aria-hidden="true" />}
              </tr>
            ))}
          </tbody>
        </table>
        <div ref={guideRef} className={styles.guide} aria-hidden="true" />
      </div>
    </div>
  );
}
