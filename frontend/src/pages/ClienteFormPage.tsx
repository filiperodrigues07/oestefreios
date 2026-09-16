import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { atualizarCliente, consultarCnpj, criarCliente, getClienteByCodigo } from '../api/clientes.api.js';
import { Button, Card, Checkbox, ErrorState, Input, LinkButton, PageHeader, Select, Skeleton, useToast } from '../components/ui/index.js';
import type { ClienteDTO, ClienteInput, RegimeTributario, TipoPessoa } from '../types/cherp.types.js';
import styles from './ClienteFormPage.module.css';

const REGIME_TRIBUTARIO_OPTIONS = [
  { value: '', label: 'Não definido' },
  { value: '1', label: 'Simples Nacional' },
  { value: '2', label: 'Simples Nacional (excesso sublimite)' },
  { value: '3', label: 'Regime Normal' },
];

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
].map((uf) => ({ value: uf, label: uf }));

const FORM_VAZIO: ClienteInput = {
  tipoPessoa: 'PJ',
  nome: '',
  nomeFantasia: '',
  documento: '',
  telefone: '',
  email: '',
  endereco: '',
  numero: '',
  bairro: '',
  complemento: '',
  cidade: '',
  uf: '',
  cep: '',
  fornecedor: false,
  transportador: false,
  representante: false,
  regimeTributario: undefined,
};

function clienteParaInput(cliente: ClienteDTO): ClienteInput {
  return {
    tipoPessoa: cliente.tipoPessoa ?? 'PJ',
    nome: cliente.razaoSocial ?? cliente.nome,
    nomeFantasia: cliente.nomeFantasia ?? '',
    documento: cliente.documento ?? '',
    telefone: cliente.telefone ?? '',
    email: cliente.email ?? '',
    endereco: cliente.endereco ?? '',
    numero: cliente.numero ?? '',
    bairro: cliente.bairro ?? '',
    complemento: cliente.complemento ?? '',
    cidade: cliente.cidade ?? '',
    uf: cliente.uf ?? '',
    cep: cliente.cep ?? '',
    fornecedor: cliente.fornecedor ?? false,
    transportador: cliente.transportador ?? false,
    representante: cliente.representante ?? false,
    regimeTributario: cliente.regimeTributario,
  };
}

/** `/clientes/novo` e `/clientes/:codigo/editar` — tela própria (não modal), cadastro/edição de cliente. */
export function ClienteFormPage() {
  const { codigo } = useParams<{ codigo?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const modoEdicao = Boolean(codigo);

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['cliente', codigo],
    queryFn: () => getClienteByCodigo(codigo!),
    enabled: modoEdicao,
  });

  const [form, setForm] = useState<ClienteInput>(FORM_VAZIO);
  const [carregado, setCarregado] = useState(false);
  const [cnpjErro, setCnpjErro] = useState<string | null>(null);

  if (modoEdicao && cliente && !carregado) {
    setForm(clienteParaInput(cliente));
    setCarregado(true);
  }

  const cnpjMutation = useMutation({
    mutationFn: (cnpj: string) => consultarCnpj(cnpj),
    onSuccess: (dados) => {
      setCnpjErro(null);
      setForm((f) => ({
        ...f,
        nome: dados.razaoSocial || f.nome,
        nomeFantasia: dados.nomeFantasia || f.nomeFantasia,
        endereco: dados.endereco || f.endereco,
        numero: dados.numero || f.numero,
        bairro: dados.bairro || f.bairro,
        cidade: dados.cidade || f.cidade,
        uf: dados.uf || f.uf,
        cep: dados.cep || f.cep,
        telefone: dados.telefone || f.telefone,
        email: dados.email || f.email,
        regimeTributario: dados.regimeTributario ?? f.regimeTributario,
      }));
    },
    onError: (err) => {
      setCnpjErro(err instanceof Error ? err.message : 'Não foi possível consultar o CNPJ — preencha manualmente.');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => (modoEdicao ? atualizarCliente(codigo!, form) : criarCliente(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      showToast(modoEdicao ? 'Cliente atualizado.' : 'Cliente cadastrado.', 'success');
      navigate('/clientes');
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
    setForm((f) => ({ ...f, tipoPessoa: tipo }));
  }

  if (modoEdicao && isLoading) {
    return (
      <div className={styles.page}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Card>
      </div>
    );
  }

  if (modoEdicao && isError) {
    return (
      <div className={styles.page}>
        <ErrorState title="Cliente não encontrado" description="Verifique o link ou volte para a lista." />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={modoEdicao ? 'Editar cliente' : 'Novo cliente'}
        description={modoEdicao ? `Código ${codigo}` : 'Preencha os dados do novo cliente.'}
        actions={
          <LinkButton to="/clientes" variant="secondary">
            Voltar
          </LinkButton>
        }
      />

      <Card className={styles.form}>
        {modoEdicao && (
          <Input label="Código" value={codigo ?? ''} disabled className={styles.codigo} />
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button
            type="button"
            variant={form.tipoPessoa === 'PJ' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleTipoPessoa('PJ')}
          >
            Pessoa Jurídica
          </Button>
          <Button
            type="button"
            variant={form.tipoPessoa === 'PF' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleTipoPessoa('PF')}
          >
            Pessoa Física
          </Button>
        </div>

        <div>
          <div className={styles.cnpjRow}>
            <Input
              label={form.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}
              value={form.documento}
              onChange={(e) => setForm({ ...form, documento: e.target.value })}
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
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        {form.tipoPessoa === 'PJ' && (
          <Input
            label="Nome Fantasia"
            value={form.nomeFantasia}
            onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
          />
        )}

        <Input label="Telefone/WhatsApp" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Tipo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <Checkbox label="Cliente" checked disabled />
            <Checkbox
              label="Fornecedor"
              checked={form.fornecedor ?? false}
              onChange={(e) => setForm({ ...form, fornecedor: e.target.checked })}
            />
            <Checkbox
              label="Transportador"
              checked={form.transportador ?? false}
              onChange={(e) => setForm({ ...form, transportador: e.target.checked })}
            />
            <Checkbox
              label="Representante"
              checked={form.representante ?? false}
              onChange={(e) => setForm({ ...form, representante: e.target.checked })}
            />
          </div>
        </div>

        {form.tipoPessoa === 'PJ' && (
          <Select
            label="Regime tributário"
            options={REGIME_TRIBUTARIO_OPTIONS}
            value={form.regimeTributario !== undefined ? String(form.regimeTributario) : ''}
            onChange={(e) =>
              setForm({
                ...form,
                regimeTributario: e.target.value === '' ? undefined : (Number(e.target.value) as RegimeTributario),
              })
            }
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
          <Input label="Endereço" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
          <Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
          <Input label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-3)' }}>
          <Input label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          <Select
            label="UF"
            options={UF_OPTIONS}
            placeholder="—"
            value={form.uf}
            onChange={(e) => setForm({ ...form, uf: e.target.value })}
          />
          <Input label="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
        </div>

        {saveMutation.isError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {saveMutation.error instanceof Error ? saveMutation.error.message : 'Erro ao salvar cliente.'}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <LinkButton to="/clientes" variant="secondary">
            Cancelar
          </LinkButton>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!form.nome.trim() || !form.documento.trim()}
          >
            Salvar
          </Button>
        </div>
      </Card>
    </div>
  );
}
