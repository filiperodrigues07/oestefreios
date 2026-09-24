import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ActionIcon } from './ActionIcon.js';
import { Button } from './Button.js';
import { useToast } from './ToastProvider.js';
import styles from './ExportButtons.module.css';

interface ExportButtonsProps {
  onExportarExcel: () => Promise<void>;
  onExportarPdf: () => Promise<void>;
  size?: 'sm' | 'md';
}

/** Botão único "Exportar" reutilizado nas telas de OS, Clientes e Produtos/Serviços — clique abre
 * um menu pra escolher Excel ou PDF, em vez de dois botões separados disputando espaço. */
export function ExportButtons({ onExportarExcel, onExportarPdf, size = 'sm' }: ExportButtonsProps) {
  const { showToast } = useToast();
  const [carregando, setCarregando] = useState<'excel' | 'pdf' | null>(null);
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (aberto) itemRefs.current[0]?.focus();
  }, [aberto]);

  function fechar() {
    setAberto(false);
    triggerRef.current?.focus();
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const itens = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const indiceAtual = itens.findIndex((el) => el === document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      fechar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      itens[(indiceAtual + 1) % itens.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      itens[(indiceAtual - 1 + itens.length) % itens.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itens[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itens[itens.length - 1]?.focus();
    }
  }

  async function executar(formato: 'excel' | 'pdf', fn: () => Promise<void>) {
    setAberto(false);
    setCarregando(formato);
    try {
      await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível exportar.', 'danger');
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        size={size}
        loading={carregando !== null}
        onClick={() => setAberto((value) => !value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setAberto(true);
          }
        }}
        aria-expanded={aberto}
        aria-haspopup="menu"
      >
        <ActionIcon name="export" />
        Exportar
        <ActionIcon name="chevronDown" size={14} />
      </Button>
      {aberto && (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Fechar opções de exportação"
            onClick={fechar}
          />
          <div
            className={styles.menu}
            role="menu"
            aria-label="Formato de exportação"
            onKeyDown={handleMenuKeyDown}
          >
            <button
              ref={(el) => {
                itemRefs.current[0] = el;
              }}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => executar('excel', onExportarExcel)}
            >
              <ActionIcon name="excel" />
              Excel
            </button>
            <button
              ref={(el) => {
                itemRefs.current[1] = el;
              }}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => executar('pdf', onExportarPdf)}
            >
              <ActionIcon name="pdf" />
              PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
