import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { criarOS } from '../api/os.api.js';
import { ClienteSearch } from '../components/search/ClienteSearch.js';
import { EquipamentoSearch } from '../components/search/EquipamentoSearch.js';
import { Button, Card, Select, useToast } from '../components/ui/index.js';
import { OfflineQueuedError } from '../pwa/OfflineQueuedError.js';
import type { ClienteDTO, EquipamentoDTO } from '../types/cherp.types.js';
import type { OSPrioridade } from '../types/os.types.js';

const PRIORIDADE_OPTIONS = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
];

/**
 * Fluxo enxuto de criação (seção 34): cliente → equipamento → problema → salvar.
 * Produtos, serviços e técnico responsável se adicionam depois, na tela de detalhe da OS.
 */
export function OSCreatePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [cliente, setCliente] = useState<ClienteDTO | null>(null);
  const [equipamento, setEquipamento] = useState<EquipamentoDTO | null>(null);
  const [problema, setProblema] = useState('');
  const [prioridade, setPrioridade] = useState<OSPrioridade>('NORMAL');

  const mutation = useMutation({
    mutationFn: () =>
      criarOS({
        clienteCodigo: cliente!.codigo,
        equipamentoCodigo: equipamento!.codigo,
        problema,
        prioridade,
      }),
    onSuccess: (os) => navigate(`/os/${os.id}`, { replace: true }),
    onError: (err) => {
      // Sem ID de servidor pra navegar (a OS ainda não existe de verdade) — volta pra lista com aviso claro.
      if (err instanceof OfflineQueuedError) {
        showToast(err.message, 'warning');
        navigate('/os', { replace: true });
      }
    },
  });

  const podeSalvar = cliente && equipamento && problema.trim().length > 0 && !mutation.isPending;

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 480 }}>
      <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xl)' }}>Nova OS</h1>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {!cliente ? (
          <ClienteSearch onSelect={setCliente} />
        ) : (
          <FieldSummary label="Cliente" value={cliente.nome} onChange={() => setCliente(null)} />
        )}

        {cliente && !equipamento && <EquipamentoSearch clienteCodigo={cliente.codigo} onSelect={setEquipamento} />}
        {cliente && equipamento && (
          <FieldSummary label="Equipamento" value={equipamento.descricao} onChange={() => setEquipamento(null)} />
        )}

        {cliente && equipamento && (
          <>
            <div>
              <label
                htmlFor="problema"
                style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}
              >
                Problema relatado
              </label>
              <textarea
                id="problema"
                value={problema}
                onChange={(e) => setProblema(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-md)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <Select
              label="Prioridade"
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as OSPrioridade)}
              options={PRIORIDADE_OPTIONS}
            />

            {mutation.isError && (
              <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                {mutation.error instanceof Error ? mutation.error.message : 'Erro ao criar OS.'}
              </p>
            )}

            <Button disabled={!podeSalvar} loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Criar OS
            </Button>
          </>
        )}
      </Card>
    </div>
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
