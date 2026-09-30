import { useState } from 'react';
import { Button, Modal } from '../ui/index.js';
import { ClienteVeiculoSection } from './ClienteVeiculoSection.js';
import type { ClienteDTO, EquipamentoDTO } from '../../types/cherp.types.js';

export interface OSVinculoInput { clienteCodigo: string; equipamentoCodigo: string }

interface Props {
  numero: number;
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (vinculo: OSVinculoInput) => void;
}

export function OSVinculoDialog(props: Props) {
  return props.open ? <DialogContent {...props} /> : null;
}

/** Corrige lançamento errado: escolhe de novo veículo e cliente (mesmo seletor da abertura da OS). */
function DialogContent({ numero, loading, onCancel, onConfirm }: Props) {
  const [cliente, setCliente] = useState<ClienteDTO | null>(null);
  const [equipamento, setEquipamento] = useState<EquipamentoDTO | null>(null);
  const pronto = cliente !== null && equipamento !== null && equipamento.clienteCodigo === cliente.codigo;
  return (
    <Modal open title={`Trocar cliente/veículo da OS #${numero}`} onClose={() => { if (!loading) onCancel(); }}
      footer={<>
        <Button variant="secondary" disabled={loading} onClick={onCancel}>Cancelar</Button>
        <Button loading={loading} disabled={!pronto}
          onClick={() => onConfirm({ clienteCodigo: cliente!.codigo, equipamentoCodigo: equipamento!.codigo })}>
          Trocar
        </Button>
      </>}>
      <p>Use só para corrigir lançamento errado. Escolha o veículo e o cliente corretos; a troca fica registrada no histórico da OS.</p>
      <ClienteVeiculoSection mode="create" cliente={cliente} equipamento={equipamento}
        onClienteChange={setCliente} onEquipamentoChange={setEquipamento} />
    </Modal>
  );
}
