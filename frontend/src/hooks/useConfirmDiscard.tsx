import { useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';

/**
 * Fechar um modal de formulário (Esc, clique fora, "Cancelar") com alteração não salva pede
 * confirmação antes — um toque acidental fora do modal não apaga o que foi digitado.
 * Use `requestClose` no lugar do `onClose` do modal e renderize `dialog`.
 */
export function useConfirmDiscard(dirty: boolean, onClose: () => void) {
  const [confirmando, setConfirmando] = useState(false);

  function requestClose() {
    if (dirty) {
      setConfirmando(true);
      return;
    }
    onClose();
  }

  const dialog = (
    <ConfirmDialog
      open={confirmando}
      centerOnMobile
      title="Descartar alterações?"
      description="Há alterações que ainda não foram salvas. Se fechar agora, o que foi digitado será perdido."
      confirmLabel="Descartar"
      cancelLabel="Continuar editando"
      danger
      onCancel={() => setConfirmando(false)}
      onConfirm={() => {
        setConfirmando(false);
        onClose();
      }}
    />
  );

  return { requestClose, dialog };
}
