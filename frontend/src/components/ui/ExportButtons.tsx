import { useState } from 'react';
import { ActionIcon } from './ActionIcon.js';
import { Button } from './Button.js';
import { useToast } from './ToastProvider.js';

interface ExportButtonsProps {
  onExportarExcel: () => Promise<void>;
  onExportarPdf: () => Promise<void>;
  size?: 'sm' | 'md';
}

/** Par "Exportar Excel"/"Exportar PDF" reutilizado nas telas de OS, Clientes e Produtos/Serviços. */
export function ExportButtons({ onExportarExcel, onExportarPdf, size = 'sm' }: ExportButtonsProps) {
  const { showToast } = useToast();
  const [carregando, setCarregando] = useState<'excel' | 'pdf' | null>(null);

  async function executar(formato: 'excel' | 'pdf', fn: () => Promise<void>) {
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
    <>
      <Button variant="secondary" size={size} loading={carregando === 'excel'} onClick={() => executar('excel', onExportarExcel)}>
        <ActionIcon name="excel" />
        Exportar Excel
      </Button>
      <Button variant="secondary" size={size} loading={carregando === 'pdf'} onClick={() => executar('pdf', onExportarPdf)}>
        <ActionIcon name="pdf" />
        Exportar PDF
      </Button>
    </>
  );
}
