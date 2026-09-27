import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useConfirmDiscard } from '../../hooks/useConfirmDiscard.js';
import { sanitizarChassi, sanitizarPlaca, somenteDigitos } from '../../utils/veiculoFormatters.js';
import { getUserErrorMessage } from '../../utils/errorPresentation.js';
import { atualizarEquipamento, criarEquipamento, getEquipamentoByCodigo } from '../../api/equipamentos.api.js';
import { ApiError } from '../../api/httpClient.js';
import { ClienteFormModal } from '../clientes/ClienteFormModal.js';
import { ClienteSearch } from '../search/ClienteSearch.js';
import { Button, Input, Modal, useToast } from '../ui/index.js';
import type { ClienteDTO, EquipamentoDTO, EquipamentoInput } from '../../types/cherp.types.js';
import styles from './VehiclePlateLookup.module.css';

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
  versao: '', combustivel: '', municipio: '', uf: '', motor: '', codigoFipe: '',
};

function formFromEquipamento(veiculo: EquipamentoDTO): Omit<EquipamentoInput, 'clienteCodigo'> {
  const marca = veiculo.marca?.trim() ?? '';
  const descricao = veiculo.descricao?.trim() ?? '';
  const modelo =
    veiculo.modelo ??
    (descricao === veiculo.identificacao
      ? ''
      : marca && (descricao === marca || descricao.startsWith(`${marca} `))
        ? descricao.slice(marca.length).trim()
        : descricao);
  return {
    placa: veiculo.identificacao ?? '',
    marca,
    modelo,
    anoFabricacao: veiculo.anoFabricacao ?? '',
    anoModelo: veiculo.anoModelo ?? '',
    cor: veiculo.cor ?? '',
    chassi: veiculo.chassi ?? '',
    versao: '', combustivel: '', municipio: '', uf: '', motor: '', codigoFipe: '',
  };
}

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
  const { showToast } = useToast();
  const [veiculoEfetivo, setVeiculoEfetivo] = useState(veiculo);
  const [form, setForm] = useState<Omit<EquipamentoInput, 'clienteCodigo'>>(() =>
    veiculo ? formFromEquipamento(veiculo) : { ...VAZIO, placa: placaInicial ?? '' },
  );
  // Referência pra detectar edição pendente — atualizada quando um cadastro existente é carregado.
  const [formOriginal, setFormOriginal] = useState(form);
  const [clienteEscolhido, setClienteEscolhido] = useState<ClienteDTO | null>(() =>
    veiculo?.clienteCodigo
      ? {
          codigo: veiculo.clienteCodigo,
          nome: veiculo.clienteNome ?? veiculo.clienteCodigo,
        }
      : null,
  );
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [carregandoDuplicado, setCarregandoDuplicado] = useState(false);

  const clienteFinal = clienteCodigo ?? clienteEscolhido?.codigo;

  const mutation = useMutation({
    mutationFn: () => {
      const input = { ...form, clienteCodigo: clienteFinal! };
      return veiculoEfetivo ? atualizarEquipamento(veiculoEfetivo.codigo, input) : criarEquipamento(input);
    },
    onSuccess: (veiculoSalvo) => {
      showToast(veiculoEfetivo ? 'Veículo atualizado.' : 'Veículo cadastrado.', 'success');
      setForm({ ...VAZIO, placa: placaInicial ?? '' });
      setClienteEscolhido(null);
      onCreated(veiculoSalvo, clienteEscolhido ?? undefined);
    },
    onError: async (err) => {
      if (!(err instanceof ApiError) || (err.code !== 'VEHICLE_DUPLICATE' && err.code !== 'VEHICLE_CHASSIS_DUPLICATE')) return;
      const duplicado = err.details as { codigo: string; descricao: string; clienteCodigo?: string; clienteNome?: string } | undefined;
      if (!duplicado?.codigo) return;
      setCarregandoDuplicado(true);
      try {
        const equipamentoExistente = await getEquipamentoByCodigo(duplicado.codigo);
        const carregado = formFromEquipamento(equipamentoExistente);
        setForm(carregado);
        setFormOriginal(carregado);
        setVeiculoEfetivo(equipamentoExistente);
        if (!clienteCodigo && equipamentoExistente.clienteCodigo) {
          setClienteEscolhido({
            codigo: equipamentoExistente.clienteCodigo,
            nome: equipamentoExistente.clienteNome ?? equipamentoExistente.clienteCodigo,
          });
        }
      } catch {
        // Falhou ao buscar o cadastro existente — mantém só o aviso (renderizado abaixo com os dados do erro).
      } finally {
        setCarregandoDuplicado(false);
      }
    },
  });

  function fecharSemConfirmar() {
    setForm({ ...VAZIO, placa: placaInicial ?? '' });
    setClienteEscolhido(null);
    onClose();
  }
  const descarte = useConfirmDiscard(JSON.stringify(form) !== JSON.stringify(formOriginal), fecharSemConfirmar);

  function handleClose() {
    if (mutation.isPending) return;
    descarte.requestClose();
  }

  const podeSalvar = form.placa.trim().length > 0 && !!clienteFinal;

  return (
    <>
    <Modal
      open={open}
      title={veiculoEfetivo ? 'Editar veículo' : 'Novo veículo'}
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
            {veiculoEfetivo ? 'Salvar' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {!clienteCodigo && (
          <div>
            {clienteEscolhido ? (
              <div className={styles.clienteRow}>
                <div>
                  <div className={styles.clienteLabel}>
                    Cliente
                  </div>
                  <div className={styles.clienteNome}>{clienteEscolhido.nome}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setClienteEscolhido(null)}
                  className={styles.linkButton}
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className={styles.stackSm}>
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

        <Input label="Placa" required value={form.placa} autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={8} onChange={(e) => setForm({ ...form, placa: sanitizarPlaca(e.target.value) })} placeholder="AAA-9999 ou AAA9A99" />
        <div
          className={styles.grid160}
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
          className={styles.grid120}
        >
          <Input
            label="Ano fab."
            inputMode="numeric"
            maxLength={4}
            value={form.anoFabricacao}
            onChange={(e) => setForm({ ...form, anoFabricacao: somenteDigitos(e.target.value, 4) })}
          />
          <Input
            label="Ano mod."
            inputMode="numeric"
            maxLength={4}
            value={form.anoModelo}
            onChange={(e) => setForm({ ...form, anoModelo: somenteDigitos(e.target.value, 4) })}
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
          autoCorrect="off"
          maxLength={17}
          value={form.chassi}
          onChange={(e) => setForm({ ...form, chassi: sanitizarChassi(e.target.value) })}
        />
        <div className={styles.extraGrid}>
          <Input label="Versão" uppercase value={form.versao} onChange={(e) => setForm({ ...form, versao: e.target.value })} />
          <Input label="Combustível" uppercase value={form.combustivel} onChange={(e) => setForm({ ...form, combustivel: e.target.value })} />
          <Input label="Município" uppercase value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
          <Input label="UF" uppercase value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} />
          <Input label="Motor/cilindrada" uppercase value={form.motor} onChange={(e) => setForm({ ...form, motor: e.target.value })} />
          <Input label="Código FIPE" value={form.codigoFipe} onChange={(e) => setForm({ ...form, codigoFipe: e.target.value })} />
        </div>

        {carregandoDuplicado && (
          <p role="status" className={styles.statusText}>
            Carregando cadastro existente...
          </p>
        )}

        {mutation.isError && (() => {
          const err = mutation.error;
          const isChassiDuplicado = err instanceof ApiError && err.code === 'VEHICLE_CHASSIS_DUPLICATE';
          const duplicado =
            err instanceof ApiError && (err.code === 'VEHICLE_DUPLICATE' || err.code === 'VEHICLE_CHASSIS_DUPLICATE')
              ? (err.details as { codigo: string; descricao: string; clienteNome?: string } | undefined)
              : undefined;
          if (duplicado) {
            return (
              <div
                role="alert"
                className={styles.duplicateBox}
              >
                <strong>{isChassiDuplicado ? 'Chassi já cadastrado' : 'Placa já cadastrada'}</strong>
                <p className={styles.statusText}>
                  {isChassiDuplicado ? 'Este chassi já está cadastrado.' : 'Esta placa já está cadastrada.'}
                </p>
                <p className={styles.statusText}>
                  Os dados do cadastro existente foram carregados acima — revise e salve para atualizá-lo, ou cancele.
                </p>
              </div>
            );
          }
          return (
            <p role="alert" className={styles.errorText}>
              {getUserErrorMessage(err, 'Não foi possível salvar o veículo. Confira os dados e tente novamente.')}
            </p>
          );
        })()}
      </div>
    </Modal>
    {descarte.dialog}
    </>
  );
}
