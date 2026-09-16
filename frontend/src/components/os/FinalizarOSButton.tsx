import { useState } from 'react';
import { Button, ConfirmDialog } from '../ui/index.js';

interface FinalizarOSButtonProps {
  onConfirm: () => void;
  loading: boolean;
}

/**
 * Finaliza a OS só no nosso app (status vira CONCLUIDA) — o mecânico não edita mais depois
 * disso (bloqueado no backend, não só aqui). A OS continua aberta no CHERP de propósito, pro
 * time de faturamento processar por lá — ver assertNaoFinalizada em backend/src/services/os.service.ts.
 */
export function FinalizarOSButton({ onConfirm, loading }: FinalizarOSButtonProps) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setConfirmando(true)}>
        Finalizar OS
      </Button>

      <ConfirmDialog
        open={confirmando}
        title="Finalizar OS?"
        description="A OS deixa de poder ser editada por aqui (o mecânico não lança mais produtos, serviços nem altera diagnóstico). Ela continua aberta no CHERP para o faturamento."
        confirmLabel="Finalizar"
        loading={loading}
        onCancel={() => setConfirmando(false)}
        onConfirm={() => {
          onConfirm();
          setConfirmando(false);
        }}
      />
    </>
  );
}
