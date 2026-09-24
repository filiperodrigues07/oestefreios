import { useState } from 'react';
import { ReasonDialog } from './ReasonDialog.js';

interface ExcluirCadastroDialogProps {
  /** Ex.: "cliente" ou "veículo" — usado nos textos. */
  tipo: string;
  /** Identificação do cadastro na mensagem (nome, placa...). */
  nome: string;
  onExcluir: (motivo: string) => Promise<unknown>;
  onClose: () => void;
  onExcluido: () => void;
}

/**
 * Exclusão de cadastro (cliente/veículo) com motivo obrigatório. Se o servidor recusar (vínculos com OS,
 * financeiro etc.), a mensagem aparece aqui dentro e o diálogo continua aberto — nada foi excluído.
 */
export function ExcluirCadastroDialog({ tipo, nome, onExcluir, onClose, onExcluido }: ExcluirCadastroDialogProps) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(motivo: string) {
    setCarregando(true);
    setErro(null);
    try {
      await onExcluir(motivo);
      onExcluido();
    } catch (err) {
      setErro(err instanceof Error ? err.message : `Não foi possível excluir o ${tipo}.`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <ReasonDialog
      open
      title={`Excluir ${tipo}?`}
      description={`"${nome}" deixa de aparecer no sistema. O histórico do CHERP não é apagado, e ${tipo} com OS ou movimentação vinculada não pode ser excluído (use Inativar).`}
      reasonLabel="Motivo da exclusão"
      confirmLabel={`Excluir ${tipo}`}
      loading={carregando}
      error={erro}
      onCancel={onClose}
      onConfirm={confirmar}
    />
  );
}
