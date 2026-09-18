import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { consultarCnpj, criarCliente } from '../../api/clientes.api.js';
import { Button, Input, Modal } from '../ui/index.js';
import type { ClienteDTO, ClienteInput, TipoPessoa } from '../../types/cherp.types.js';
import { formatarDocumento, formatarTelefone } from '../../utils/clienteFormatters.js';

interface ClienteFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (cliente: ClienteDTO) => void;
}

function formVazio(): ClienteInput {
  return {
    ativo: true,
    tipoPessoa: 'PJ',
    nome: '',
    nomeFantasia: '',
    documento: '',
    telefone: '',
    celular: '',
  };
}

/**
 * Cadastro rápido de cliente direto do fluxo de abertura de OS — só os campos essenciais pra
 * identificar e contatar o cliente (nome, documento, telefone). Endereço, e-mails e dados fiscais
 * completos continuam editáveis depois em Clientes; aqui o objetivo é não interromper a OS.
 */
export function ClienteFormModal({ open, onClose, onCreated }: ClienteFormModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClienteInput>(formVazio());
  const [cnpjErro, setCnpjErro] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(formVazio());
      setCnpjErro(null);
    }
  }, [open]);

  const cnpjMutation = useMutation({
    mutationFn: (cnpj: string) => consultarCnpj(cnpj),
    onSuccess: (dados) => {
      setCnpjErro(null);
      setForm((f) => ({
        ...f,
        nome: dados.razaoSocial || f.nome,
        nomeFantasia: dados.nomeFantasia || f.nomeFantasia,
        telefone: dados.telefone ? formatarTelefone(dados.telefone) : f.telefone,
      }));
    },
    onError: (err) => {
      setCnpjErro(err instanceof Error ? err.message : 'Não foi possível consultar o CNPJ — preencha manualmente.');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => criarCliente(form),
    onSuccess: (cliente) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      onCreated(cliente);
    },
  });

  function buscarCnpj() {
    const digits = form.documento.replace(/\D/g, '');
    if (digits.length !== 14) {
      setCnpjErro('CNPJ precisa ter 14 dígitos.');
      return;
    }
    cnpjMutation.mutate(digits);
  }

  function handleTipoPessoa(tipo: TipoPessoa) {
    setForm((f) => ({ ...f, tipoPessoa: tipo, documento: '' }));
    setCnpjErro(null);
  }

  const podeSalvar = form.nome.trim().length > 0 && form.documento.trim().length > 0 && !saveMutation.isPending;

  return (
    <Modal
      open={open}
      title="Novo cliente"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!podeSalvar}>
            Cadastrar
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button type="button" variant={form.tipoPessoa === 'PJ' ? 'primary' : 'secondary'} size="sm" onClick={() => handleTipoPessoa('PJ')}>
            Pessoa Jurídica
          </Button>
          <Button type="button" variant={form.tipoPessoa === 'PF' ? 'primary' : 'secondary'} size="sm" onClick={() => handleTipoPessoa('PF')}>
            Pessoa Física
          </Button>
        </div>

        <div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <Input
              label={form.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}
              required
              value={form.documento}
              inputMode="numeric"
              maxLength={form.tipoPessoa === 'PJ' ? 18 : 14}
              onChange={(e) => setForm({ ...form, documento: formatarDocumento(e.target.value, form.tipoPessoa) })}
            />
            {form.tipoPessoa === 'PJ' && (
              <Button type="button" variant="secondary" loading={cnpjMutation.isPending} onClick={buscarCnpj}>
                Buscar CNPJ
              </Button>
            )}
          </div>
          {cnpjErro && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>{cnpjErro}</span>
          )}
        </div>

        <Input
          label={form.tipoPessoa === 'PJ' ? 'Razão Social' : 'Nome completo'}
          required
          uppercase
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        {form.tipoPessoa === 'PJ' && (
          <Input label="Nome Fantasia" uppercase value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input label="Celular / WhatsApp" value={form.celular} inputMode="tel" maxLength={15} onChange={(e) => setForm({ ...form, celular: formatarTelefone(e.target.value) })} />
          <Input label="Telefone fixo" value={form.telefone} inputMode="tel" maxLength={15} onChange={(e) => setForm({ ...form, telefone: formatarTelefone(e.target.value) })} />
        </div>

        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          Endereço, e-mail e dados fiscais completos podem ser preenchidos depois, em Clientes.
        </p>

        {saveMutation.isError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {saveMutation.error instanceof Error ? saveMutation.error.message : 'Erro ao cadastrar cliente.'}
          </p>
        )}
      </div>
    </Modal>
  );
}
