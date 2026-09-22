import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { atualizarEquipamento, criarEquipamento } from '../../api/equipamentos.api.js';
import { ApiError } from '../../api/httpClient.js';
import { ClienteFormModal } from '../clientes/ClienteFormModal.js';
import { ClienteSearch } from '../search/ClienteSearch.js';
import { Button, Input, LinkButton, Modal } from '../ui/index.js';
import type { ClienteDTO, EquipamentoDTO, EquipamentoInput } from '../../types/cherp.types.js';

interface VeiculoFormModalProps {
  open: boolean;
  /** Já conhecido (fluxo antigo) → pula a escolha de cliente. Ausente → exige escolher dentro do modal. */
  clienteCodigo?: string;
  /** Placa já digitada na busca que não encontrou nada — pré-preenche o campo. */
  placaInicial?: string;
  veiculo?: EquipamentoDTO;
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
export function VeiculoFormModal(props: VeiculoFormModalProps) {
  return props.open ? (
    <VeiculoFormContent key={props.veiculo?.codigo ?? 'novo'} {...props} />
  ) : null;
}

function VeiculoFormContent({
  open,
  clienteCodigo,
  placaInicial,
  veiculo,
  onClose,
  onCreated,
}: VeiculoFormModalProps) {
  const [form, setForm] = useState<Omit<EquipamentoInput, 'clienteCodigo'>>(() => {
    const marca = veiculo?.marca?.trim() ?? '';
    const descricao = veiculo?.descricao?.trim() ?? '';
    const modelo =
      veiculo?.modelo ??
      (descricao === veiculo?.identificacao
        ? ''
        : marca && (descricao === marca || descricao.startsWith(`${marca} `))
          ? descricao.slice(marca.length).trim()
          : descricao);
    return veiculo
      ? {
          placa: veiculo.identificacao ?? '',
          marca,
          modelo,
          anoFabricacao: veiculo.anoFabricacao ?? '',
          anoModelo: veiculo.anoModelo ?? '',
          cor: veiculo.cor ?? '',
          chassi: veiculo.chassi ?? '',
        }
      : { ...VAZIO, placa: placaInicial ?? '' };
  });
  const [clienteEscolhido, setClienteEscolhido] = useState<ClienteDTO | null>(() =>
    veiculo?.clienteCodigo
      ? {
          codigo: veiculo.clienteCodigo,
          nome: veiculo.clienteNome ?? veiculo.clienteCodigo,
        }
      : null,
  );
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);

  const clienteFinal = clienteCodigo ?? clienteEscolhido?.codigo;

  const mutation = useMutation({
    mutationFn: () => {
      const input = { ...form, clienteCodigo: clienteFinal! };
      return veiculo ? atualizarEquipamento(veiculo.codigo, input) : criarEquipamento(input);
    },
    onSuccess: (veiculo) => {
      setForm({ ...VAZIO, placa: placaInicial ?? '' });
      setClienteEscolhido(null);
      onCreated(veiculo, clienteEscolhido ?? undefined);
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setForm({ ...VAZIO, placa: placaInicial ?? '' });
    setClienteEscolhido(null);
    onClose();
  }

  const podeSalvar = form.placa.trim().length > 0 && !!clienteFinal;

  return (
    <Modal
      open={open}
      title={veiculo ? 'Editar veículo' : 'Novo veículo'}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!podeSalvar}
          >
            {veiculo ? 'Salvar' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {!clienteCodigo && (
          <div>
            {clienteEscolhido ? (
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Cliente
                  </div>
                  <div style={{ fontWeight: 600 }}>{clienteEscolhido.nome}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setClienteEscolhido(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <ClienteSearch onSelect={setClienteEscolhido} />
                <Button type="button" variant="secondary" size="sm" onClick={() => setNovoClienteAberto(true)}>
                  + Cadastrar novo cliente
                </Button>
              </div>
            )}
          </div>
        )}

        <ClienteFormModal
          open={novoClienteAberto}
          mode="create"
          onClose={() => setNovoClienteAberto(false)}
          onSaved={(clienteNovo) => {
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          <Input
            label="Marca"
            uppercase
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: e.target.value })}
          />
          <Input
            label="Modelo"
            uppercase
            value={form.modelo}
            onChange={(e) => setForm({ ...form, modelo: e.target.value })}
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          <Input
            label="Ano fab."
            value={form.anoFabricacao}
            onChange={(e) => setForm({ ...form, anoFabricacao: e.target.value })}
          />
          <Input
            label="Ano mod."
            value={form.anoModelo}
            onChange={(e) => setForm({ ...form, anoModelo: e.target.value })}
          />
          <Input
            label="Cor"
            uppercase
            value={form.cor}
            onChange={(e) => setForm({ ...form, cor: e.target.value })}
          />
        </div>
        <Input
          label="Chassi"
          uppercase
          value={form.chassi}
          onChange={(e) => setForm({ ...form, chassi: e.target.value })}
        />

        {mutation.isError && (() => {
          const err = mutation.error;
          const duplicado =
            err instanceof ApiError && err.code === 'VEHICLE_DUPLICATE'
              ? (err.details as { codigo: string; descricao: string; clienteNome?: string } | undefined)
              : undefined;
          if (duplicado) {
            return (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                  border: '1px solid var(--color-warning)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-warning-surface)',
                  padding: 'var(--space-3)',
                }}
              >
                <strong>Veículo já cadastrado</strong>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {err instanceof Error ? err.message : ''}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {duplicado.descricao}{duplicado.clienteNome ? ` · Cliente: ${duplicado.clienteNome}` : ''}
                </p>
                <LinkButton to={`/veiculos?busca=${encodeURIComponent(form.placa)}`} variant="secondary" size="sm">
                  Ver veículo cadastrado
                </LinkButton>
              </div>
            );
          }
          return (
            <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              {err instanceof Error ? err.message : 'Erro ao salvar veículo.'}
            </p>
          );
        })()}
      </div>
    </Modal>
  );
}
