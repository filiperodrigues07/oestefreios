import { useId, useRef, useState } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import styles from './ColumnChooser.module.css';

export interface ColumnChooserItem {
  key: string;
  label: string;
  visivel: boolean;
}

interface ColumnChooserProps {
  /** Colunas móveis na ordem atual (inclusive as escondidas). */
  itens: ColumnChooserItem[];
  onAlternar: (key: string) => void;
  /** Move uma posição pra cima (-1) ou pra baixo (+1) — alternativa de teclado ao arrastar o cabeçalho. */
  onMover: (key: string, direcao: -1 | 1) => void;
  onRestaurar: () => void;
  personalizado: boolean;
}

/** Botão "Colunas": escolher quais aparecem e em que ordem. Preferência por usuário e por tela. */
export function ColumnChooser({ itens, onAlternar, onMover, onRestaurar, personalizado }: ColumnChooserProps) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelId = useId();
  useClickOutside(raizRef, () => setAberto(false), aberto);

  const visiveis = itens.filter((i) => i.visivel).length;
  const ocultas = itens.length - visiveis;

  return (
    <div
      className={styles.raiz}
      ref={raizRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && aberto) {
          event.stopPropagation();
          setAberto(false);
          botaoRef.current?.focus();
        }
      }}
    >
      <button
        ref={botaoRef}
        type="button"
        className={styles.botao}
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAberto((v) => !v)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M15 4v16" />
        </svg>
        Colunas{ocultas > 0 ? ` (${ocultas} oculta${ocultas > 1 ? 's' : ''})` : ''}
      </button>

      {aberto && (
        <div className={styles.painel} id={painelId} role="group" aria-label="Colunas da tabela">
          <p className={styles.dica}>Marque as colunas que quer ver. Também dá para arrastar o cabeçalho para mudar a ordem.</p>
          <ul className={styles.lista}>
            {itens.map((item, indice) => {
              const ultimaVisivel = item.visivel && visiveis === 1;
              return (
                <li key={item.key} className={styles.item}>
                  <label className={styles.rotulo} title={ultimaVisivel ? 'Pelo menos uma coluna fica visível' : undefined}>
                    <input
                      type="checkbox"
                      checked={item.visivel}
                      disabled={ultimaVisivel}
                      onChange={() => onAlternar(item.key)}
                    />
                    <span>{item.label}</span>
                  </label>
                  <span className={styles.setas}>
                    <button
                      type="button"
                      className={styles.seta}
                      disabled={indice === 0}
                      aria-label={`Mover ${item.label} para cima`}
                      onClick={() => onMover(item.key, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.seta}
                      disabled={indice === itens.length - 1}
                      aria-label={`Mover ${item.label} para baixo`}
                      onClick={() => onMover(item.key, 1)}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className={styles.rodape}>
            <button type="button" className={styles.restaurar} disabled={!personalizado} onClick={onRestaurar}>
              Restaurar padrão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
