import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        type="button"
        variant="secondary"
        size={size}
        loading={carregando !== null}
        onClick={() => setAberto((value) => !value)}
        aria-expanded={aberto}
        aria-haspopup="menu"
      >
        <ActionIcon name="export" />
        Exportar
        <ActionIcon name="chevronDown" size={14} />
      </Button>
      {aberto && (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.item} onClick={() => executar('excel', onExportarExcel)}>
            <ActionIcon name="excel" />
            Excel
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => executar('pdf', onExportarPdf)}>
            <ActionIcon name="pdf" />
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
