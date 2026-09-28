import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ActionIcon } from './ActionIcon.js';
import buttonStyles from './EditButton.module.css';
import styles from './RowActionsMenu.module.css';

type IconName = Parameters<typeof ActionIcon>[0]['name'];

export interface RowActionItem {
  key: string;
  label: string;
  icon: IconName;
  onSelect: () => void | Promise<void>;
  danger?: boolean;
  /** Linha separadora antes deste item (agrupa "enviar" de "gerenciar"). */
  separar?: boolean;
}

interface RowActionsMenuProps {
  /** Nome acessível do botão, ex. "Ações da OS #9709". */
  label: string;
  items: RowActionItem[];
}

const LARGURA_MENU = 220;

/**
 * Botão "⋯" de linha de tabela: junta as ações de uma linha num menu só, pra coluna Ações não
 * crescer a cada ação nova. O menu vai por portal com posição fixa porque o container da tabela
 * rola na horizontal e cortaria um dropdown absoluto.
 */
export function RowActionsMenu({ label, items }: RowActionsMenuProps) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; acima: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function abrir() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const alturaEstimada = items.length * 44 + 24;
    // Última linha da tela: abre pra cima em vez de sair da janela.
    const acima = r.bottom + alturaEstimada > window.innerHeight - 8 && r.top > alturaEstimada;
    const left = Math.max(8, Math.min(r.right - LARGURA_MENU, window.innerWidth - LARGURA_MENU - 8));
    setPos({ top: acima ? r.top - 4 : r.bottom + 4, left, acima });
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto || !pos) return;
    itemRefs.current.find(Boolean)?.focus();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!menuRef.current?.contains(alvo) && !triggerRef.current?.contains(alvo)) setAberto(false);
    };
    // Posição é fixa: rolar a página/tabela ou redimensionar deixaria o menu solto no ar.
    const fechar = () => setAberto(false);
    document.addEventListener('pointerdown', fora);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('pointerdown', fora);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto, pos]);

  function fecharEFocar() {
    setAberto(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const lista = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const atual = lista.findIndex((el) => el === document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      fecharEFocar();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      fecharEFocar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      lista[(atual + 1) % lista.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      lista[(atual - 1 + lista.length) % lista.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      lista[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      lista[lista.length - 1]?.focus();
    }
  }

  async function selecionar(item: RowActionItem) {
    setAberto(false);
    setOcupado(true);
    try {
      await item.onSelect();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={buttonStyles.button}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={aberto}
        disabled={ocupado}
        onClick={(e) => {
          e.stopPropagation();
          if (aberto) setAberto(false);
          else abrir();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            abrir();
          }
        }}
      >
        {ocupado ? <span className={styles.spinner} aria-hidden="true" /> : <ActionIcon name="more" />}
      </button>
      {aberto && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={styles.menu}
          style={{ top: pos.top, left: pos.left, width: LARGURA_MENU, transform: pos.acima ? 'translateY(-100%)' : undefined }}
          onKeyDown={handleKeyDown}
          // Evento de portal sobe pela árvore React: sem isto o clique no item abriria a linha.
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => { itemRefs.current[index] = el; }}
              type="button"
              role="menuitem"
              className={`${styles.item} ${item.danger ? styles.danger : ''} ${item.separar ? styles.separar : ''}`}
              onClick={() => { void selecionar(item); }}
            >
              <ActionIcon name={item.icon} />
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
