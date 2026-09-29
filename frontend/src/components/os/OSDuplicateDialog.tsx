import { useState } from 'react';
import { Button, Modal } from '../ui/index.js';
import { OSKmFields, parseKm } from './OSKmFields.js';

export interface OSKmInput { kmAtual: number; kmFinal: number }

interface Props {
  numero: number;
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (km: OSKmInput) => void;
}

export function OSDuplicateDialog(props: Props) {
  return props.open ? <DialogContent {...props} /> : null;
}

function DialogContent({ numero, loading, onCancel, onConfirm }: Props) {
  const [kmAtual, setKmAtual] = useState('');
  const [kmFinal, setKmFinal] = useState('');
  const inicial = parseKm(kmAtual);
  const final = parseKm(kmFinal);
  return (
    <Modal open title={`Duplicar OS #${numero}?`} onClose={() => { if (!loading) onCancel(); }}
      footer={<>
        <Button variant="secondary" disabled={loading} onClick={onCancel}>Cancelar</Button>
        <Button loading={loading} disabled={inicial === undefined || final === undefined}
          onClick={() => onConfirm({ kmAtual: inicial!, kmFinal: final! })}>Duplicar OS</Button>
      </>}>
      <p>Cliente, veículo, problema, prioridade, itens e diagnóstico serão copiados. Informe os KM da nova OS.</p>
      <OSKmFields kmAtual={kmAtual} kmFinal={kmFinal} onKmAtualChange={setKmAtual} onKmFinalChange={setKmFinal} disabled={loading} />
    </Modal>
  );
}
