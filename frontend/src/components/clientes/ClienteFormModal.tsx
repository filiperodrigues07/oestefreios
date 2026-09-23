import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClienteByCodigo } from '../../api/clientes.api.js';
import { Modal, Skeleton, useToast } from '../ui/index.js';
import type { ClienteDTO } from '../../types/cherp.types.js';
import { ClienteForm } from './ClienteForm.js';

interface ClienteFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** Obrigatório em modo `edit`. */
  codigo?: string;
  onClose: () => void;
  onSaved: (cliente: ClienteDTO) => void;
}

/**
 * Cadastro/edição de cliente direto de dentro do fluxo de OS — abre o formulário completo (mesmo
 * usado em `/clientes/novo` e `/clientes/:codigo/editar`) num modal, sem sair da OS em andamento.
 */
export function ClienteFormModal({ open, mode, codigo, onClose, onSaved }: ClienteFormModalProps) {
  const { showToast } = useToast();
  const [clienteCarregado, setClienteCarregado] = useState<ClienteDTO | null>(null);
  useEffect(() => {
    if (!open) setClienteCarregado(null);
  }, [open]);
  const { data: clienteInicial, isLoading } = useQuery({
    queryKey: ['cliente', codigo],
    queryFn: () => getClienteByCodigo(codigo!),
    enabled: open && mode === 'edit' && !!codigo,
  });

  return (
    <Modal open={open} title={mode === 'edit' || clienteCarregado ? 'Editar cliente' : 'Novo cliente'} onClose={onClose}>
      {mode === 'edit' && isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      ) : (
        <ClienteForm
          mode={mode}
          codigo={codigo}
          clienteInicial={clienteInicial}
          onExistingLoaded={setClienteCarregado}
          onSaved={(cliente) => {
            showToast(mode === 'edit' || clienteCarregado ? 'Cliente atualizado.' : 'Cliente cadastrado.', 'success');
            onSaved(cliente);
          }}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
