import { useState } from 'react';
import { ActionIcon, Button, ConfirmDialog } from '../ui/index.js';

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
      <Button variant="primary" size="sm" onClick={() => setConfirmando(true)}>
        <ActionIcon name="ready" />
        Finalizar OS
      </Button>

      <ConfirmDialog
        open={confirmando}
        title="Finalizar OS?"
        description="A OS será finalizada no app e a situação de atendimento do CHERP será atualizada para Pronta. Ela permanecerá disponível no CHERP para faturamento."
        confirmLabel="Finalizar OS"
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
