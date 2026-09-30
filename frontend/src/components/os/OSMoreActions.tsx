import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ActionIcon, Button } from '../ui/index.js';
import styles from './OSMoreActions.module.css';
import { useClickOutside } from '../../hooks/useClickOutside.js';

type IconName = Parameters<typeof ActionIcon>[0]['name'];

export interface MoreActionItem {
  key: string;
  label: string;
  icon: IconName;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface OSMoreActionsProps {
  items: MoreActionItem[];
  loading?: boolean;
  /** Rótulo do botão (some no celular, fica só o ícone). Padrão: "Mais ações". */
  label?: string;
  icon?: IconName;
  className?: string;
}

/** Menu "Mais ações": ações secundárias da OS saem da barra pra ela não virar uma fileira de botões.
 * Ação perigosa (danger) fica sempre por último, separada. Teclado igual ao ExportButtons. */
export function OSMoreActions({ items, loading, label = 'Mais ações', icon = 'more', className }: OSMoreActionsProps) {
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useClickOutside(wrapperRef, () => setAberto(false), aberto);

  useLayoutEffect(() => {
    if (!aberto) return;
    function positionMenu() {
      const menu = menuRef.current;
      if (!menu) return;
      menu.style.transform = '';
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 16;
      const right = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? document.documentElement.clientWidth) - 16;
      menu.style.maxWidth = `${Math.max(0, right - left)}px`;
      const rect = menu.getBoundingClientRect();
      const offset = Math.max(left - rect.left, Math.min(0, right - rect.right));
      menu.style.transform = `translateX(${offset}px)`;
    }
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('scroll', positionMenu);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.visualViewport?.removeEventListener('resize', positionMenu);
      window.visualViewport?.removeEventListener('scroll', positionMenu);
    };
  }, [aberto]);

  useEffect(() => {
    if (aberto) itemRefs.current.find((el) => el && !el.disabled)?.focus();
  }, [aberto]);

  function fechar() {
    setAberto(false);
    triggerRef.current?.focus();
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const itens = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null && !el.disabled);
    if (itens.length === 0) return;
    const atual = itens.findIndex((el) => el === document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      fechar();
    } else if (e.key === 'Tab') {
      setAberto(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      itens[(atual + 1) % itens.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      itens[(atual - 1 + itens.length) % itens.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itens[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itens[itens.length - 1]?.focus();
    }
  }

  function selecionar(item: MoreActionItem) {
    setAberto(false);
    item.onSelect();
  }

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`} ref={wrapperRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        size="sm"
        loading={loading}
        onClick={() => setAberto((value) => !value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setAberto(true);
          }
        }}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label={label}
      >
        <ActionIcon name={icon} />
        <span className={styles.triggerLabel}>{label}</span>
        <span className={styles.triggerChevron}><ActionIcon name="chevronDown" size={14} /></span>
      </Button>
      {aberto && (
        <div ref={menuRef} className={styles.menu} role="menu" onKeyDown={handleMenuKeyDown}>
          {items.map((item, index) => (
            <div key={item.key} className={item.danger ? styles.dangerGroup : undefined}>
              <button
                ref={(el) => { itemRefs.current[index] = el; }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                onClick={() => selecionar(item)}
              >
                <ActionIcon name={item.icon} />
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
