import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getClienteByCodigo } from '../../api/clientes.api.js';
import { EquipamentoSearch } from '../search/EquipamentoSearch.js';
import { ClienteSearch } from '../search/ClienteSearch.js';
import { PlacaSearch } from '../search/PlacaSearch.js';
import { ClienteFormModal } from '../clientes/ClienteFormModal.js';
import { ActionIcon, Card, Button } from '../ui/index.js';
import styles from './ClienteVeiculoSection.module.css';
import { VeiculoFormModal } from '../veiculos/VeiculoFormModal.js';
import type { ClienteDTO, EquipamentoDTO } from '../../types/cherp.types.js';

interface ClienteVeiculoSectionCreateProps {
  mode: 'create';
  cliente: ClienteDTO | null;
  equipamento: EquipamentoDTO | null;
  onClienteChange: (cliente: ClienteDTO | null) => void;
  onEquipamentoChange: (equipamento: EquipamentoDTO | null) => void;
}

interface ClienteVeiculoSectionEditProps {
  mode: 'edit';
  clienteCodigo: string;
  clienteNome: string;
  veiculoDescricao: string;
}

type ClienteVeiculoSectionProps = ClienteVeiculoSectionCreateProps | ClienteVeiculoSectionEditProps;

/**
 * Seção Cliente/Veículo — em modo `edit` é um resumo com atalho pra editar o cadastro do cliente
 * sem sair da OS (reatribuir cliente/veículo de uma OS já criada no CHERP não é suportado, ver
 * notas da Fase OS-3 do plano). Em modo `create` são dois blocos independentes (Veículo / Cliente)
 * que resolvem em qualquer ordem.
 */
export function ClienteVeiculoSection(props: ClienteVeiculoSectionProps) {
  if (props.mode === 'edit') {
    return <ClienteVeiculoEditSummary {...props} />;
  }

  return <ClienteVeiculoCreatePicker {...props} />;
}

function ClienteVeiculoEditSummary({ clienteCodigo, clienteNome, veiculoDescricao }: ClienteVeiculoSectionEditProps) {
  const queryClient = useQueryClient();
  const [editandoCliente, setEditandoCliente] = useState(false);

  return (
    <div className={styles.editCards}>
      <div className={styles.summaryCard}>
        <span className={styles.cardIcon}>♙</span>
        <span>
          <small>Cliente</small>
          <strong>{clienteCodigo} {clienteNome}</strong>
        </span>
        <button type="button" className={styles.trocarButton} onClick={() => setEditandoCliente(true)}>
          Editar cadastro ›
        </button>
      </div>
      <div className={styles.summaryCard}>
        <span className={styles.cardIcon}>▱</span>
        <span>
          <small>Veículo</small>
          <strong>{veiculoDescricao}</strong>
        </span>
      </div>

      <ClienteFormModal
        open={editandoCliente}
        mode="edit"
        codigo={clienteCodigo}
        onClose={() => setEditandoCliente(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['cliente', clienteCodigo] });
          setEditandoCliente(false);
        }}
      />
    </div>
  );
}

/** Mesmo visual do resumo de edição (`.summaryCard`) — só troca o "Editar cadastro ›" por "Trocar" (ação). */
function SlotSummary({ icon, label, value, onTrocar }: { icon: string; label: string; value: string; onTrocar: () => void }) {
  return (
    <div className={styles.summaryCard}>
      <span className={styles.cardIcon}>{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      <button type="button" className={styles.trocarButton} onClick={onTrocar}>
        Trocar
      </button>
    </div>
  );
}

function ClienteVeiculoCreatePicker({ cliente, equipamento, onClienteChange, onEquipamentoChange }: ClienteVeiculoSectionCreateProps) {
  const [novoVeiculoAberto, setNovoVeiculoAberto] = useState(false);
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [placaDigitada, setPlacaDigitada] = useState('');
  const [resolvendoCliente, setResolvendoCliente] = useState(false);

  async function handlePlacaSelect(veiculo: EquipamentoDTO) {
    onEquipamentoChange(veiculo);
    setResolvendoCliente(true);
    try {
      const clienteDoVeiculo = await getClienteByCodigo(veiculo.clienteCodigo);
      onClienteChange(clienteDoVeiculo);
    } catch {
      // Veículo achado mas cliente não resolveu (raro) — segue pendente, busca manual no bloco Cliente.
    } finally {
      setResolvendoCliente(false);
    }
  }

  return (
    <Card>
      <div className={styles.pickerGrid}>
        <div className={styles.slot}>
          <div className={styles.slotTitle}>Veículo</div>
          {equipamento ? (
            <SlotSummary
              icon="▱"
              label="Veículo"
              value={`${equipamento.identificacao ?? ''} · ${equipamento.descricao}`.trim()}
              onTrocar={() => onEquipamentoChange(null)}
            />
          ) : (
            <>
              {cliente ? (
                <EquipamentoSearch clienteCodigo={cliente.codigo} onSelect={onEquipamentoChange} />
              ) : (
                <PlacaSearch onSelect={handlePlacaSelect} onQueryChange={setPlacaDigitada} />
              )}
              <Button type="button" variant="secondary" size="sm" onClick={() => setNovoVeiculoAberto(true)}>
                <ActionIcon name="add" />
                Cadastrar novo veículo
              </Button>
            </>
          )}
        </div>

        <div className={styles.slot}>
          <div className={styles.slotTitle}>Cliente</div>
          {cliente ? (
            <SlotSummary icon="♙" label="Cliente" value={cliente.nome} onTrocar={() => onClienteChange(null)} />
          ) : resolvendoCliente ? (
            <p className={styles.resolvendo}>Buscando cliente do veículo...</p>
          ) : (
            <>
              <ClienteSearch onSelect={onClienteChange} />
              <Button type="button" variant="secondary" size="sm" onClick={() => setNovoClienteAberto(true)}>
                <ActionIcon name="add" />
                Cadastrar novo cliente
              </Button>
            </>
          )}
        </div>
      </div>

      <VeiculoFormModal
        open={novoVeiculoAberto}
        clienteCodigo={cliente?.codigo}
        placaInicial={placaDigitada}
        onClose={() => setNovoVeiculoAberto(false)}
        onCreated={(veiculo, clienteDoNovoVeiculo) => {
          onEquipamentoChange(veiculo);
          if (clienteDoNovoVeiculo) onClienteChange(clienteDoNovoVeiculo);
          setNovoVeiculoAberto(false);
        }}
      />

      <ClienteFormModal
        open={novoClienteAberto}
        mode="create"
        onClose={() => setNovoClienteAberto(false)}
        onSaved={(clienteNovo) => {
          onClienteChange(clienteNovo);
          setNovoClienteAberto(false);
        }}
      />
    </Card>
  );
}
