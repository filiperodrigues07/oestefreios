import { useState, type ReactNode } from 'react';
import { getClienteByCodigo } from '../../api/clientes.api.js';
import { ClienteFormModal } from '../clientes/ClienteFormModal.js';
import { EquipamentoSearch } from '../search/EquipamentoSearch.js';
import { ClienteSearch } from '../search/ClienteSearch.js';
import { PlacaSearch } from '../search/PlacaSearch.js';
import { Card } from '../ui/index.js';
import { Link } from 'react-router';
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
 * Seção Cliente/Veículo — em modo `edit` é só um resumo (reatribuir cliente/veículo de uma OS
 * já criada no CHERP não é suportado hoje, ver notas da Fase OS-3 do plano). Em modo `create`
 * é o fluxo placa-primeiro: nada é gravado até "Criar OS".
 */
export function ClienteVeiculoSection(props: ClienteVeiculoSectionProps) {
  if (props.mode === 'edit') {
    return (
      <div className={styles.editCards}>
        <Link to={`/clientes?busca=${encodeURIComponent(props.clienteNome)}`} className={styles.summaryCard}><span className={styles.cardIcon}>♙</span><span><small>Cliente</small><strong>{props.clienteCodigo} {props.clienteNome}</strong></span><b>Ver cadastro ›</b></Link>
        <div className={styles.summaryCard}><span className={styles.cardIcon}>▱</span><span><small>Veículo</small><strong>{props.veiculoDescricao}</strong></span><b>Ver detalhes ›</b></div>
      </div>
    );
  }

  return <ClienteVeiculoCreatePicker {...props} />;
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--color-primary)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-sm)',
        textAlign: 'left',
        padding: 0,
      }}
    >
      {children}
    </button>
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
      // Veículo achado mas cliente não resolveu (raro) — usuário escolhe manualmente abaixo.
    } finally {
      setResolvendoCliente(false);
    }
  }

  function limpar() {
    onEquipamentoChange(null);
    onClienteChange(null);
  }

  // Veículo e cliente já resolvidos (via placa ou cadastro manual) — resumo, pronto pra "Criar OS".
  if (equipamento && cliente) {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <FieldSummary label="Veículo" value={`${equipamento.identificacao ?? ''} · ${equipamento.descricao}`.trim()} onChange={limpar} />
        <FieldSummary label="Cliente" value={cliente.nome} onChange={limpar} />
      </Card>
    );
  }

  // Achou o veículo mas não deu pra resolver o cliente dono automaticamente — deixa escolher.
  if (equipamento && !cliente) {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <FieldSummary label="Veículo" value={`${equipamento.identificacao ?? ''} · ${equipamento.descricao}`.trim()} onChange={limpar} />
        {resolvendoCliente ? (
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Buscando cliente...</p>
        ) : (
          <>
            <ClienteSearch onSelect={onClienteChange} />
            <LinkButton onClick={() => setNovoClienteAberto(true)}>+ Cadastrar novo cliente</LinkButton>
          </>
        )}

        <ClienteFormModal
          open={novoClienteAberto}
          onClose={() => setNovoClienteAberto(false)}
          onCreated={(clienteNovo) => {
            onClienteChange(clienteNovo);
            setNovoClienteAberto(false);
          }}
        />
      </Card>
    );
  }

  // Cliente escolhido (cadastrado agora ou já existente) mas ainda sem veículo — busca só entre os dele.
  if (cliente && !equipamento) {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <FieldSummary label="Cliente" value={cliente.nome} onChange={limpar} />
        <EquipamentoSearch clienteCodigo={cliente.codigo} onSelect={onEquipamentoChange} />
        <LinkButton onClick={() => setNovoVeiculoAberto(true)}>+ Cadastrar novo veículo</LinkButton>

        <VeiculoFormModal
          open={novoVeiculoAberto}
          clienteCodigo={cliente.codigo}
          onClose={() => setNovoVeiculoAberto(false)}
          onCreated={(veiculo) => {
            onEquipamentoChange(veiculo);
            setNovoVeiculoAberto(false);
          }}
        />
      </Card>
    );
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <PlacaSearch onSelect={handlePlacaSelect} onQueryChange={setPlacaDigitada} />
      <LinkButton onClick={() => setNovoVeiculoAberto(true)}>+ Cadastrar novo veículo</LinkButton>
      <LinkButton onClick={() => setNovoClienteAberto(true)}>+ Cadastrar novo cliente</LinkButton>

      <VeiculoFormModal
        open={novoVeiculoAberto}
        placaInicial={placaDigitada}
        onClose={() => setNovoVeiculoAberto(false)}
        onCreated={(veiculo, clienteDoNovoVeiculo) => {
          onEquipamentoChange(veiculo);
          onClienteChange(clienteDoNovoVeiculo ?? null);
          setNovoVeiculoAberto(false);
        }}
      />

      <ClienteFormModal
        open={novoClienteAberto}
        onClose={() => setNovoClienteAberto(false)}
        onCreated={(clienteNovo) => {
          onClienteChange(clienteNovo);
          setNovoClienteAberto(false);
        }}
      />
    </Card>
  );
}

function FieldSummary({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</div>
        <div style={{ fontWeight: 600 }}>{value}</div>
      </div>
      <button
        type="button"
        onClick={onChange}
        style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
      >
        Trocar
      </button>
    </div>
  );
}
