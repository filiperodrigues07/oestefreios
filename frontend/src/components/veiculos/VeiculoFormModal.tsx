import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { criarEquipamento } from '../../api/equipamentos.api.js';
import { ClienteFormModal } from '../clientes/ClienteFormModal.js';
import { ClienteSearch } from '../search/ClienteSearch.js';
import { Button, Input, Modal } from '../ui/index.js';
import type { ClienteDTO, EquipamentoDTO, EquipamentoInput } from '../../types/cherp.types.js';

interface VeiculoFormModalProps {
  open: boolean;
  /** Já conhecido (fluxo antigo) → pula a escolha de cliente. Ausente → exige escolher dentro do modal. */
  clienteCodigo?: string;
  /** Placa já digitada na busca que não encontrou nada — pré-preenche o campo. */
  placaInicial?: string;
  onClose: () => void;
  onCreated: (veiculo: EquipamentoDTO, cliente?: ClienteDTO) => void;
}

const VAZIO: Omit<EquipamentoInput, 'clienteCodigo'> = {
  placa: '',
  marca: '',
  modelo: '',
  anoFabricacao: '',
  anoModelo: '',
  cor: '',
  chassi: '',
};

/**
 * Cadastro rápido de veículo — fluxo placa-primeiro da OS (Fase OS-3): a placa buscada não
 * existe no CHERP, então além dos dados do veículo, também precisa confirmar de quem ele é
 * (CHAVECLIFOR é obrigatório lá) — a menos que o cliente já tenha vindo pronto (`clienteCodigo`).
 */
export function VeiculoFormModal({ open, clienteCodigo, placaInicial, onClose, onCreated }: VeiculoFormModalProps) {
  const [form, setForm] = useState({ ...VAZIO, placa: placaInicial ?? '' });
  const [clienteEscolhido, setClienteEscolhido] = useState<ClienteDTO | null>(null);
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);

  // `placaInicial` só existe de verdade no momento em que o modal abre (a busca por placa que
  // não achou nada) — useState só captura o valor do primeiro mount, então precisa resincronizar
  // aqui toda vez que `open` vira true, senão o campo fica sempre vazio.
  useEffect(() => {
    if (open) {
      setForm({ ...VAZIO, placa: placaInicial ?? '' });
      setClienteEscolhido(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clienteFinal = clienteCodigo ?? clienteEscolhido?.codigo;

  const mutation = useMutation({
    mutationFn: () => criarEquipamento({ ...form, clienteCodigo: clienteFinal! }),
    onSuccess: (veiculo) => {
      setForm({ ...VAZIO, placa: placaInicial ?? '' });
      setClienteEscolhido(null);
      onCreated(veiculo, clienteEscolhido ?? undefined);
    },
  });

  function handleClose() {
    setForm({ ...VAZIO, placa: placaInicial ?? '' });
    setClienteEscolhido(null);
    onClose();
  }

  const podeSalvar = form.placa.trim().length > 0 && !!clienteFinal;

  return (
    <Modal
      open={open}
      title="Novo veículo"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!podeSalvar}>
            Cadastrar
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {!clienteCodigo && (
          <div>
            {clienteEscolhido ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Cliente</div>
                  <div style={{ fontWeight: 600 }}>{clienteEscolhido.nome}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setClienteEscolhido(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <ClienteSearch onSelect={setClienteEscolhido} />
                <button
                  type="button"
                  onClick={() => setNovoClienteAberto(true)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', textAlign: 'left', padding: 0 }}
                >
                  + Cadastrar novo cliente
                </button>
              </div>
            )}
          </div>
        )}

        <ClienteFormModal
          open={novoClienteAberto}
          onClose={() => setNovoClienteAberto(false)}
          onCreated={(clienteNovo) => {
            setClienteEscolhido(clienteNovo);
            setNovoClienteAberto(false);
          }}
        />

        <Input
          label="Placa"
          required
          value={form.placa}
          onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
          placeholder="AAA-9999 ou AAA9A99"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input label="Marca" uppercase value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
          <Input label="Modelo" uppercase value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
          <Input
            label="Ano fab."
            value={form.anoFabricacao}
            onChange={(e) => setForm({ ...form, anoFabricacao: e.target.value })}
          />
          <Input label="Ano mod." value={form.anoModelo} onChange={(e) => setForm({ ...form, anoModelo: e.target.value })} />
          <Input label="Cor" uppercase value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
        </div>
        <Input label="Chassi" uppercase value={form.chassi} onChange={(e) => setForm({ ...form, chassi: e.target.value })} />

        {mutation.isError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {mutation.error instanceof Error ? mutation.error.message : 'Erro ao cadastrar veículo.'}
          </p>
        )}
      </div>
    </Modal>
  );
}
