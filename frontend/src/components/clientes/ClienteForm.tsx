import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { atualizarCliente, consultarCep, consultarCnpj, consultarInscricaoEstadual, criarCliente, getClienteByCodigo, getClienteByDocumento } from '../../api/clientes.api.js';
import { ApiError } from '../../api/httpClient.js';
import { Button, Checkbox, ConfirmDialog, Input, RequiredMark, Select, useToast } from '../ui/index.js';
import type { ClienteDTO, ClienteInput, RegimeTributario, TipoPessoa } from '../../types/cherp.types.js';
import { formatarCep, formatarDocumento, formatarTelefone } from '../../utils/clienteFormatters.js';
import styles from './ClienteForm.module.css';

const REGIME_TRIBUTARIO_OPTIONS = [
  { value: '1', label: 'Simples Nacional' },
  { value: '2', label: 'Simples Nacional (excesso sublimite)' },
  { value: '3', label: 'Regime Normal' },
];

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
].map((uf) => ({ value: uf, label: uf }));

const FORM_VAZIO: ClienteInput = {
  ativo: true,
  tipoPessoa: 'PJ',
  nome: '',
  nomeFantasia: '',
  documento: '',
  telefone: '',
  celular: '',
  email: '',
  emailFinanceiro: '',
  emailNfe: '',
  homePage: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  reducaoMva: undefined,
  coreRepresentante: '',
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
    ativo: cliente.ativo ?? true,
    tipoPessoa: cliente.tipoPessoa ?? 'PJ',
    nome: cliente.razaoSocial ?? cliente.nome,
    nomeFantasia: cliente.nomeFantasia ?? '',
    documento: formatarDocumento(cliente.documento ?? '', cliente.tipoPessoa ?? 'PJ'),
    telefone: formatarTelefone(cliente.telefone ?? ''),
    celular: formatarTelefone(cliente.celular ?? ''),
    email: cliente.email ?? '',
    emailFinanceiro: cliente.emailFinanceiro ?? '',
    emailNfe: cliente.emailNfe ?? '',
    homePage: cliente.homePage ?? '',
    inscricaoEstadual: cliente.inscricaoEstadual ?? '',
    inscricaoMunicipal: cliente.inscricaoMunicipal ?? '',
    reducaoMva: cliente.reducaoMva,
    coreRepresentante: cliente.coreRepresentante ?? '',
    endereco: cliente.endereco ?? '',
    numero: cliente.numero ?? '',
    bairro: cliente.bairro ?? '',
    complemento: cliente.complemento ?? '',
    cidade: cliente.cidade ?? '',
    uf: cliente.uf ?? '',
    cep: formatarCep(cliente.cep ?? ''),
    fornecedor: cliente.fornecedor ?? false,
    transportador: cliente.transportador ?? false,
    representante: cliente.representante ?? false,
    regimeTributario: cliente.regimeTributario,
  };
}

interface ClienteFormProps {
  mode: 'create' | 'edit';
  /** Obrigatório em modo `edit`. */
  codigo?: string;
  /** Obrigatório em modo `edit` — dados já carregados por quem chama (página ou modal). */
  clienteInicial?: ClienteDTO;
  onSaved: (cliente: ClienteDTO) => void;
  onCancel: () => void;
  cancelLabel?: string;
  onExistingLoaded?: (cliente: ClienteDTO) => void;
}

/**
 * Formulário de cadastro/edição de cliente — usado tanto na tela cheia (`ClienteFormPage`)
 * quanto dentro de um modal (`ClienteFormModal`, aberto direto do fluxo de OS pra criar ou
 * editar cliente sem perder o que já estava sendo preenchido na OS).
 */
export function ClienteForm({ mode, codigo, clienteInicial, onSaved, onCancel, cancelLabel = 'Cancelar', onExistingLoaded }: ClienteFormProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState<ClienteInput>(() => (clienteInicial ? clienteParaInput(clienteInicial) : FORM_VAZIO));
  const [documentoErro, setDocumentoErro] = useState<string | null>(null);
  const [cepErro, setCepErro] = useState<string | null>(null);
  const [clienteEncontrado, setClienteEncontrado] = useState<ClienteDTO | null>(null);
  const [consultandoDocumento, setConsultandoDocumento] = useState(false);
  const [carregandoDuplicado, setCarregandoDuplicado] = useState(false);
  const documentoAtual = useRef(form.documento.replace(/\D/g, ''));
  const consultaSequencia = useRef(0);
  const [modoEfetivo, setModoEfetivo] = useState(mode);
  const [codigoEfetivo, setCodigoEfetivo] = useState(codigo);
  const modoEdicao = modoEfetivo === 'edit';

  const cnpjMutation = useMutation({
    mutationFn: ({ cnpj }: { cnpj: string; sequencia: number }) => consultarCnpj(cnpj),
    onSuccess: (dados, { cnpj, sequencia }) => {
      if (sequencia !== consultaSequencia.current || documentoAtual.current !== cnpj) return;
      setDocumentoErro(null);
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
        telefone: dados.telefone ? formatarTelefone(dados.telefone) : f.telefone,
        email: dados.email || f.email,
        regimeTributario: dados.regimeTributario ?? f.regimeTributario,
      }));
    },
    onError: (err, { cnpj, sequencia }) => {
      if (sequencia !== consultaSequencia.current || documentoAtual.current !== cnpj) return;
      setDocumentoErro(err instanceof Error ? err.message : 'Não foi possível consultar o CNPJ — preencha manualmente.');
    },
  });

  /** IE (Onda 3, SINTEGRA Brasil) — busca junto do CNPJ. Sem chave configurada ou com erro de rede,
   * fica em silêncio (nunca trava o cadastro); "não achou nada" avisa por toast, porque senão fica
   * indistinguível de "não fez nada" pra quem está testando/usando. */
  const ieMutation = useMutation({
    mutationFn: ({ cnpj }: { cnpj: string; sequencia: number }) => consultarInscricaoEstadual(cnpj),
    onSuccess: (lista, { cnpj, sequencia }) => {
      if (sequencia !== consultaSequencia.current || documentoAtual.current !== cnpj) return;
      const match = lista.find((item) => item.ativo && (!form.uf || item.uf === form.uf)) ?? lista.find((item) => item.ativo) ?? lista[0];
      if (match) {
        setForm((f) => ({ ...f, inscricaoEstadual: match.numero }));
        showToast('Inscrição Estadual preenchida automaticamente.', 'success');
      } else {
        showToast('Inscrição Estadual não encontrada no SINTEGRA para esse CNPJ — preencha manualmente se necessário.', 'info');
      }
    },
  });

  const cepMutation = useMutation({
    mutationFn: (cep: string) => consultarCep(cep),
    onSuccess: (dados) => {
      setCepErro(null);
      setForm((f) => ({
        ...f,
        cep: dados.cep ? formatarCep(dados.cep) : f.cep,
        endereco: dados.endereco || f.endereco,
        bairro: dados.bairro || f.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
      }));
    },
    onError: (err) => setCepErro(err instanceof Error ? err.message : 'Não foi possível consultar o CEP.'),
  });

  const saveMutation = useMutation({
    mutationFn: () => (modoEdicao ? atualizarCliente(codigoEfetivo!, form) : criarCliente(form)),
    onSuccess: (cliente) => onSaved(cliente),
    onError: async (err) => {
      if (!(err instanceof ApiError) || err.code !== 'CLIENT_DUPLICATE') return;
      const duplicado = err.details as { codigo: string; nome: string } | undefined;
      if (!duplicado?.codigo) return;
      setCarregandoDuplicado(true);
      try {
        const clienteExistente = await getClienteByCodigo(duplicado.codigo);
        setClienteEncontrado(clienteExistente);
      } catch {
        // Mantém o aviso de erro de salvamento se a leitura do cadastro falhar.
      } finally {
        setCarregandoDuplicado(false);
      }
    },
  });

  async function consultarDocumento() {
    const digits = form.documento.replace(/\D/g, '');
    const ehCnpj = form.tipoPessoa === 'PJ';
    if (digits.length !== (ehCnpj ? 14 : 11)) {
      setDocumentoErro(`${ehCnpj ? 'CNPJ' : 'CPF'} precisa ter ${ehCnpj ? 14 : 11} dígitos.`);
      return;
    }
    setDocumentoErro(null);
    setConsultandoDocumento(true);
    const sequencia = ++consultaSequencia.current;
    try {
      const existente = await getClienteByDocumento(digits);
      if (sequencia !== consultaSequencia.current || documentoAtual.current !== digits) return;
      if (existente && existente.codigo !== codigoEfetivo) {
        setClienteEncontrado(existente);
        return;
      }
      if (!ehCnpj) {
        showToast(existente ? 'Este CPF pertence ao cadastro atual.' : 'CPF não cadastrado no CHERP. Preencha os dados do cliente.', 'info');
        return;
      }
      cnpjMutation.mutate({ cnpj: digits, sequencia });
      ieMutation.mutate({ cnpj: digits, sequencia });
    } catch (err) {
      if (sequencia === consultaSequencia.current) {
        setDocumentoErro(err instanceof Error ? err.message : 'Não foi possível consultar o documento.');
      }
    } finally {
      if (sequencia === consultaSequencia.current) setConsultandoDocumento(false);
    }
  }

  function carregarClienteEncontrado() {
    if (!clienteEncontrado) return;
    consultaSequencia.current++;
    documentoAtual.current = clienteEncontrado.documento?.replace(/\D/g, '') ?? '';
    setForm(clienteParaInput(clienteEncontrado));
    setModoEfetivo('edit');
    setCodigoEfetivo(clienteEncontrado.codigo);
    onExistingLoaded?.(clienteEncontrado);
    setClienteEncontrado(null);
    setDocumentoErro(null);
    saveMutation.reset();
  }

  function buscarCep() {
    const digits = (form.cep ?? '').replace(/\D/g, '');
    if (digits.length !== 8) {
      setCepErro('CEP precisa ter 8 dígitos.');
      return;
    }
    cepMutation.mutate(digits);
  }

  const [trocaTipoPendente, setTrocaTipoPendente] = useState<TipoPessoa | null>(null);

  /** IE (form.inscricaoEstadual) é a mesma coluna do CHERP usada pra RG na PF — não é exclusiva de PJ,
   * fica de fora da limpeza (ver comentário de podeSalvar acima). */
  function temDadosExclusivosPreenchidos(indoPara: TipoPessoa): boolean {
    if (indoPara === 'PF') {
      return (
        Boolean(form.nomeFantasia?.trim()) ||
        form.regimeTributario !== undefined ||
        Boolean(form.documento.trim())
      );
    }
    return Boolean(form.documento.trim());
  }

  function aplicarTrocaTipo(tipo: TipoPessoa) {
    consultaSequencia.current++;
    documentoAtual.current = '';
    setDocumentoErro(null);
    setConsultandoDocumento(false);
    setClienteEncontrado(null);
    setForm((f) => ({
      ...f,
      tipoPessoa: tipo,
      documento: '',
      ...(tipo === 'PF' ? { nomeFantasia: '', regimeTributario: undefined } : {}),
    }));
  }

  function handleTipoPessoa(tipo: TipoPessoa) {
    if (tipo === form.tipoPessoa) return;
    if (temDadosExclusivosPreenchidos(tipo)) {
      setTrocaTipoPendente(tipo);
      return;
    }
    aplicarTrocaTipo(tipo);
  }

  // Campos obrigatórios pra parear com o CHERP — só na criação (edição de cliente antigo/incompleto
  // continua liberada). Nome Fantasia, Inscrição Estadual/Identidade e Regime tributário só valem
  // pra pessoa jurídica (esse campo de identidade é a mesma coluna do CHERP usada pra RG na física).
  const ehPJ = form.tipoPessoa === 'PJ';
  const podeSalvar =
    form.nome.trim().length > 0 &&
    form.documento.trim().length > 0 &&
    (modoEdicao ||
      ((!ehPJ || (form.nomeFantasia ?? '').trim().length > 0) &&
        (!ehPJ || (form.inscricaoEstadual ?? '').trim().length > 0) &&
        (!ehPJ || form.regimeTributario !== undefined) &&
        (form.cep ?? '').trim().length > 0 &&
        (form.endereco ?? '').trim().length > 0 &&
        (form.numero ?? '').trim().length > 0 &&
        (form.bairro ?? '').trim().length > 0 &&
        (form.cidade ?? '').trim().length > 0 &&
        (form.uf ?? '').trim().length > 0 &&
        (form.celular ?? '').trim().length > 0));

  return (
    <div className={styles.form}>
      {modoEdicao && <Input label="Código" value={codigoEfetivo ?? ''} disabled className={styles.codigo} />}

      <div className={styles.sectionTitle}>Pessoa</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <Button type="button" variant={form.tipoPessoa === 'PJ' ? 'primary' : 'secondary'} size="sm" onClick={() => handleTipoPessoa('PJ')}>
          Pessoa Jurídica
        </Button>
        <Button type="button" variant={form.tipoPessoa === 'PF' ? 'primary' : 'secondary'} size="sm" onClick={() => handleTipoPessoa('PF')}>
          Pessoa Física
        </Button>
      </div>

      <div>
        <div className={styles.fieldLabel}>Status</div>
        <div className={styles.statusOptions} role="group" aria-label="Status do cliente">
          <Button type="button" variant={form.ativo !== false ? 'primary' : 'secondary'} size="sm" onClick={() => setForm({ ...form, ativo: true })}>Ativo</Button>
          <Button type="button" variant={form.ativo === false ? 'primary' : 'secondary'} size="sm" onClick={() => setForm({ ...form, ativo: false })}>Inativo</Button>
        </div>
      </div>

      <div>
        <div className={styles.cnpjRow}>
          <Input
            label={<>{form.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}<RequiredMark /></>}
            required
            value={form.documento}
            inputMode="numeric"
            maxLength={form.tipoPessoa === 'PJ' ? 18 : 14}
            onChange={(e) => {
              const documento = formatarDocumento(e.target.value, form.tipoPessoa);
              documentoAtual.current = documento.replace(/\D/g, '');
              consultaSequencia.current++;
              setDocumentoErro(null);
              setConsultandoDocumento(false);
              setClienteEncontrado(null);
              setForm({ ...form, documento });
            }}
          />
          <Button type="button" variant="secondary" loading={consultandoDocumento || cnpjMutation.isPending} onClick={() => void consultarDocumento()}>
            Consultar {form.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}
          </Button>
        </div>
        {documentoErro && <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>{documentoErro}</span>}
      </div>

      <div className={styles.twoColumns}>
        <Input
          label={<>{form.tipoPessoa === 'PJ' ? 'Razão Social' : 'Nome completo'}<RequiredMark /></>}
          required
          uppercase
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        <Input
          label={<>Nome Fantasia{!modoEdicao && ehPJ && <RequiredMark />}</>}
          required={!modoEdicao && ehPJ}
          uppercase
          value={form.nomeFantasia}
          onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
        />
      </div>

      <div>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Tipo</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Checkbox label="Cliente" checked disabled />
          <Checkbox label="Fornecedor" checked={form.fornecedor ?? false} onChange={(e) => setForm({ ...form, fornecedor: e.target.checked })} />
          <Checkbox label="Transportador" checked={form.transportador ?? false} onChange={(e) => setForm({ ...form, transportador: e.target.checked })} />
          <Checkbox label="Representante" checked={form.representante ?? false} onChange={(e) => setForm({ ...form, representante: e.target.checked })} />
        </div>
      </div>

      {form.tipoPessoa === 'PJ' && (
        <Select
          label={<>Regime tributário{!modoEdicao && <RequiredMark />}</>}
          required={!modoEdicao}
          placeholder="Selecione"
          options={REGIME_TRIBUTARIO_OPTIONS}
          value={form.regimeTributario !== undefined ? String(form.regimeTributario) : ''}
          onChange={(e) => setForm({ ...form, regimeTributario: e.target.value === '' ? undefined : (Number(e.target.value) as RegimeTributario) })}
        />
      )}

      <div className={styles.threeColumns}>
        <Input
          label={<>{form.tipoPessoa === 'PJ' ? 'Inscrição estadual' : 'Identidade (RG)'}{!modoEdicao && ehPJ && <RequiredMark />}</>}
          required={!modoEdicao && ehPJ}
          uppercase
          value={form.inscricaoEstadual}
          onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })}
        />
        <Input label="Inscrição municipal" uppercase value={form.inscricaoMunicipal} onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })} />
        <Input label="Redução MVA" type="number" inputMode="numeric" min="0" value={form.reducaoMva ?? ''} onChange={(e) => setForm({ ...form, reducaoMva: e.target.value === '' ? undefined : Number(e.target.value) })} />
      </div>

      <div className={styles.addressHeader}>Endereço</div>
      <div className={styles.cepRow}>
        <Input
          label={<>CEP{!modoEdicao && <RequiredMark />}</>}
          required={!modoEdicao}
          value={form.cep ?? ''}
          inputMode="numeric"
          maxLength={9}
          onChange={(e) => setForm({ ...form, cep: formatarCep(e.target.value) })}
          onBlur={() => { if ((form.cep ?? '').replace(/\D/g, '').length === 8) buscarCep(); }}
          error={cepErro ?? undefined}
        />
        <Button type="button" variant="secondary" loading={cepMutation.isPending} onClick={buscarCep}>Consultar CEP</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
        <Input label={<>Endereço{!modoEdicao && <RequiredMark />}</>} required={!modoEdicao} uppercase value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
        <Input label={<>Número{!modoEdicao && <RequiredMark />}</>} required={!modoEdicao} uppercase value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
        <Input label={<>Bairro{!modoEdicao && <RequiredMark />}</>} required={!modoEdicao} uppercase value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
        <Input label="Complemento" uppercase value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
        <Input label={<>Cidade{!modoEdicao && <RequiredMark />}</>} required={!modoEdicao} uppercase value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
        <Select
          label={<>UF{!modoEdicao && <RequiredMark />}</>}
          required={!modoEdicao}
          options={UF_OPTIONS}
          placeholder="—"
          value={form.uf}
          onChange={(e) => setForm({ ...form, uf: e.target.value })}
        />
      </div>

      <div className={styles.twoColumns}>
        <Input label={<>Celular / WhatsApp{!modoEdicao && <RequiredMark />}</>} required={!modoEdicao} value={form.celular} inputMode="tel" maxLength={15} onChange={(e) => setForm({ ...form, celular: formatarTelefone(e.target.value) })} />
        <Input label="Telefone fixo" value={form.telefone} inputMode="tel" maxLength={15} onChange={(e) => setForm({ ...form, telefone: formatarTelefone(e.target.value) })} />
      </div>

      <div className={styles.addressHeader}>E-mails e contato</div>
      <div className={styles.twoColumns}>
        <Input label="E-mail comercial" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="E-mail financeiro" type="email" autoComplete="off" value={form.emailFinanceiro} onChange={(e) => setForm({ ...form, emailFinanceiro: e.target.value })} />
        <Input label="E-mail NFe/NFSe" type="email" autoComplete="off" value={form.emailNfe} onChange={(e) => setForm({ ...form, emailNfe: e.target.value })} />
        <Input label="Site" type="url" value={form.homePage} onChange={(e) => setForm({ ...form, homePage: e.target.value })} />
      </div>

      {form.representante && <Input label="CORE (representante)" uppercase value={form.coreRepresentante} onChange={(e) => setForm({ ...form, coreRepresentante: e.target.value })} />}

      {carregandoDuplicado && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
          Carregando cadastro existente...
        </p>
      )}

      {saveMutation.isError && (() => {
        const err = saveMutation.error;
        const duplicado =
          err instanceof ApiError && err.code === 'CLIENT_DUPLICATE'
            ? (err.details as { codigo: string; nome: string } | undefined)
            : undefined;
        if (duplicado && !clienteEncontrado && !carregandoDuplicado) {
          return (
            <div className={styles.duplicateWarning} role="alert">
              <strong>Cliente já cadastrado</strong>
              <p>
                Já existe um cliente com esse documento, mas não foi possível carregar o cadastro. Tente consultar novamente.
              </p>
              <p>{duplicado.nome} · Código: {duplicado.codigo}</p>
            </div>
          );
        }
        if (duplicado) return null;
        return (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {err instanceof Error ? err.message : 'Erro ao salvar cliente.'}
          </p>
        );
      })()}

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!podeSalvar}>
          {modoEdicao ? 'Salvar' : 'Cadastrar'}
        </Button>
      </div>

      <ConfirmDialog
        open={clienteEncontrado !== null}
        centerOnMobile
        title="Cliente já cadastrado"
        description={clienteEncontrado ? `${clienteEncontrado.nome} · Código ${clienteEncontrado.codigo} · ${clienteEncontrado.ativo === false ? 'Inativo' : 'Ativo'}. Deseja carregar os dados desse cliente para edição?` : ''}
        confirmLabel="Carregar cadastro"
        cancelLabel="Voltar ao formulário"
        onCancel={() => setClienteEncontrado(null)}
        onConfirm={carregarClienteEncontrado}
      />

      <ConfirmDialog
        open={trocaTipoPendente !== null}
        title="Alterar tipo de pessoa?"
        description={
          trocaTipoPendente === 'PF'
            ? 'Ao mudar de Pessoa Jurídica para Pessoa Física, os dados exclusivos de empresa (CNPJ, Nome Fantasia, Regime Tributário) serão removidos.'
            : 'Ao mudar de Pessoa Física para Pessoa Jurídica, o documento (CPF) será removido — informe o CNPJ correto.'
        }
        confirmLabel="Alterar e limpar"
        onCancel={() => setTrocaTipoPendente(null)}
        onConfirm={() => {
          if (trocaTipoPendente) aplicarTrocaTipo(trocaTipoPendente);
          setTrocaTipoPendente(null);
        }}
      />
    </div>
  );
}
