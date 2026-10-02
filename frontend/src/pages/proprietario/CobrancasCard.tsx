import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import {
  anexarBoleto,
  atualizarCobranca,
  baixarCobranca,
  criarCobranca,
  desfazerBaixa,
  enviarCobranca,
  gerarCobrancas,
  getCobrancaConfig,
  removerCobranca,
  saveCobrancaConfig,
  testarCobrancaSmtp,
} from '../../api/billing.api.js';
import { salvarBlobComoArquivo } from '../../api/httpClient.js';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  CurrencyInput,
  ConfirmDialog,
  Input,
  Modal,
  PasswordInput,
  RowActionsMenu,
  Select,
  Skeleton,
  useToast,
  type BadgeTone,
  type RowActionItem,
} from '../../components/ui/index.js';
import type {
  BillingDTO,
  CobrancaConfigDTO,
  CobrancaDTO,
  CobrancaInput,
} from '../../types/billing.types.js';
import {
  cobrancasCsv,
  contarFiltros,
  filtrarCobrancas,
  proximaReferenciaLivre,
  referenciasSeguidas,
  vencimentoDoMes,
  type FiltroCobranca,
} from './cobrancas.js';
import { dataBr, hojeLocal, mesAno, moeda } from './formatos.js';
import styles from './CobrancasCard.module.css';

const SEGURANCA = [
  { value: 'starttls', label: 'STARTTLS (587)' },
  { value: 'ssl', label: 'SSL/TLS (465)' },
  { value: 'nenhuma', label: 'Nenhuma' },
];

function situacao(cobranca: CobrancaDTO): { texto: string; tom: BadgeTone; icone: string } {
  if (cobranca.pagoEm)
    return { texto: `Paga em ${dataBr(cobranca.pagoEm)}`, tom: 'success', icone: '✓' };
  const vencida = cobranca.vencimento < hojeLocal();
  if (!cobranca.arquivoNome) {
    return {
      texto: vencida ? 'Vencida, sem boleto anexado' : 'Sem boleto anexado',
      tom: vencida ? 'danger' : 'neutral',
      icone: vencida ? '!' : '○',
    };
  }
  if (cobranca.enviadoEm) {
    return {
      texto: `Enviada em ${dataBr(cobranca.enviadoEm)} para ${cobranca.enviadoPara.length} e-mail(s)${vencida ? ' · vencida' : ''}`,
      tom: vencida ? 'danger' : 'primary',
      icone: vencida ? '!' : '✉',
    };
  }
  return {
    texto: vencida ? 'Vencida, sem envio' : 'Aguardando envio',
    tom: vencida ? 'danger' : 'warning',
    icone: '!',
  };
}

const tamanho = (bytes: number | null) =>
  bytes === null
    ? '—'
    : bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function invalidarCobrancas(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['billing'] });
  void queryClient.invalidateQueries({ queryKey: ['billing-status'] });
  void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
}

function validarPdf(file: File | null): string | null {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) return 'O PDF pode ter no máximo 5 MB.';
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'Escolha o boleto em PDF.';
  }
  return null;
}

function CampoPdf({
  id,
  label,
  obrigatorio,
  arquivo,
  erro,
  onEscolher,
}: {
  id: string;
  label: string;
  obrigatorio: boolean;
  arquivo: File | null;
  erro: string | null;
  onEscolher: (file: File | null) => void;
}) {
  return (
    <div className={styles.arquivo}>
      <label htmlFor={id} className={styles.arquivoLabel}>
        {label} {obrigatorio && <span aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        required={obrigatorio}
        onChange={(e) => onEscolher(e.target.files?.[0] ?? null)}
      />
      {arquivo && (
        <small className={styles.hint}>
          {arquivo.name} · {tamanho(arquivo.size)}
        </small>
      )}
      {erro && (
        <small role="alert" className={styles.erro}>
          {erro}
        </small>
      )}
    </div>
  );
}

/** Cria (com ou sem PDF) ou edita uma cobrança em aberto. */
function CobrancaModal({
  billing,
  cobranca,
  onClose,
}: {
  billing: BillingDTO;
  cobranca?: CobrancaDTO;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const editando = Boolean(cobranca);
  const [form, setForm] = useState<CobrancaInput>(() => {
    if (cobranca) {
      const { referencia, vencimento, valor, observacao, linhaDigitavel, pixCopiaCola } = cobranca;
      return { referencia, vencimento, valor, observacao, linhaDigitavel, pixCopiaCola };
    }
    const referencia = proximaReferenciaLivre(
      billing.cobrancas,
      billing.vencimentoAtual ?? hojeLocal(),
    );
    return {
      referencia,
      vencimento: vencimentoDoMes(referencia, billing.diaVencimento),
      valor: billing.valorMensal,
      observacao: '',
      linhaDigitavel: '',
      pixCopiaCola: '',
    };
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const mesRepetido =
    form.referencia !== cobranca?.referencia &&
    billing.cobrancas.some((item) => item.referencia === form.referencia);

  const mutation = useMutation({
    mutationFn: () =>
      cobranca ? atualizarCobranca(cobranca.id, form) : criarCobranca({ ...form, arquivo }),
    onSuccess: () => {
      showToast(
        editando
          ? 'Cobrança atualizada.'
          : arquivo
            ? 'Cobrança criada com o boleto.'
            : 'Cobrança criada. Anexe o boleto quando tiver.',
        'success',
      );
      invalidarCobrancas(queryClient);
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'danger'),
  });

  function escolher(file: File | null) {
    const erro = validarPdf(file);
    setErroArquivo(erro);
    setArquivo(erro ? null : file);
  }

  function mudarReferencia(referencia: string) {
    // Na criação o vencimento acompanha o mês escolhido; na edição o proprietário decide.
    setForm((atual) => ({
      ...atual,
      referencia,
      ...(!editando && referencia
        ? { vencimento: vencimentoDoMes(referencia, billing.diaVencimento) }
        : {}),
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!mesRepetido && !erroArquivo) mutation.mutate();
  }

  return (
    <Modal
      open
      title={editando ? `Editar cobrança de ${mesAno(cobranca!.referencia)}` : 'Nova cobrança'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-cobranca"
            loading={mutation.isPending}
            disabled={mesRepetido}
          >
            {editando ? 'Salvar' : arquivo ? 'Criar com boleto' : 'Criar cobrança'}
          </Button>
        </>
      }
    >
      <form id="form-cobranca" onSubmit={submit} className={styles.form}>
        <div className={styles.duasColunas}>
          <Input
            label="Mês de referência"
            type="month"
            required
            value={form.referencia}
            onChange={(e) => mudarReferencia(e.target.value)}
          />
          <Input
            label="Vencimento"
            type="date"
            required
            value={form.vencimento}
            onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
          />
        </div>
        {mesRepetido && (
          <p role="alert" className={styles.erro}>
            Já existe uma cobrança para {mesAno(form.referencia)}. Edite a existente.
          </p>
        )}
        <CurrencyInput
          label="Valor (R$)"
          required
          value={form.valor}
          onValueChange={(valor) => setForm({ ...form, valor })}
        />
        <Input
          label="Observação (opcional)"
          maxLength={300}
          value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
        />
        <fieldset className={styles.grupo}>
          <legend>Para pagar sem abrir o PDF (opcional)</legend>
          <Input
            label="Linha digitável"
            inputMode="numeric"
            maxLength={80}
            placeholder="07790.00116 12345.678901 ..."
            value={form.linhaDigitavel}
            onChange={(e) => setForm({ ...form, linhaDigitavel: e.target.value })}
          />
          <Input
            label="PIX copia e cola"
            maxLength={600}
            value={form.pixCopiaCola}
            onChange={(e) => setForm({ ...form, pixCopiaCola: e.target.value })}
          />
          <small className={styles.hint}>Vão no corpo do e-mail, junto com o PDF.</small>
        </fieldset>
        {!editando && (
          <CampoPdf
            id="arquivo-boleto"
            label="Boleto em PDF (opcional — dá para anexar depois)"
            obrigatorio={false}
            arquivo={arquivo}
            erro={erroArquivo}
            onEscolher={escolher}
          />
        )}
      </form>
    </Modal>
  );
}

function AnexarModal({ cobranca, onClose }: { cobranca: CobrancaDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (file: File) => anexarBoleto(cobranca.id, file),
    onSuccess: () => {
      showToast('Boleto anexado.', 'success');
      invalidarCobrancas(queryClient);
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível anexar.', 'danger'),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!arquivo) {
      setErro('Escolha o PDF do boleto.');
      return;
    }
    mutation.mutate(arquivo);
  }

  return (
    <Modal
      open
      title={`${cobranca.arquivoNome ? 'Trocar' : 'Anexar'} boleto de ${mesAno(cobranca.referencia)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-anexar" loading={mutation.isPending}>
            Anexar
          </Button>
        </>
      }
    >
      <form id="form-anexar" onSubmit={submit} className={styles.form}>
        <p className={styles.hint}>
          {moeda(cobranca.valor)} · vence em {dataBr(cobranca.vencimento)}
          {cobranca.arquivoNome ? ` · substitui ${cobranca.arquivoNome}` : ''}
        </p>
        <CampoPdf
          id="arquivo-anexar"
          label="Boleto em PDF (Banco Inter)"
          obrigatorio
          arquivo={arquivo}
          erro={erro}
          onEscolher={(file) => {
            const problema = validarPdf(file);
            setErro(problema);
            setArquivo(problema ? null : file);
          }}
        />
      </form>
    </Modal>
  );
}

const OPCOES_MESES = [
  { value: '1', label: '1 mês' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
];

/** Cria em lote as cobranças dos próximos meses, sem PDF, com o valor e o dia da assinatura. */
function GerarModal({ billing, onClose }: { billing: BillingDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [inicio, setInicio] = useState(() =>
    proximaReferenciaLivre(billing.cobrancas, billing.vencimentoAtual ?? hojeLocal()),
  );
  const [meses, setMeses] = useState('6');
  const existentes = new Set(billing.cobrancas.map((item) => item.referencia));
  const referencias = inicio ? referenciasSeguidas(inicio, Number(meses)) : [];
  const novas = referencias.filter((ref) => !existentes.has(ref));
  const puladas = referencias.filter((ref) => existentes.has(ref));
  const semValor = billing.valorMensal <= 0;

  const mutation = useMutation({
    mutationFn: () => gerarCobrancas({ inicio, meses: Number(meses) }),
    onSuccess: (resultado) => {
      showToast(
        `${resultado.criadas.length} cobrança(s) criada(s)${resultado.puladas.length ? `, ${resultado.puladas.length} já existia(m)` : ''}.`,
        'success',
      );
      invalidarCobrancas(queryClient);
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível gerar.', 'danger'),
  });

  return (
    <Modal
      open
      title="Gerar cobranças dos próximos meses"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={semValor || novas.length === 0}
          >
            Gerar {novas.length || ''} cobrança{novas.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <div className={styles.duasColunas}>
          <Input
            label="A partir de"
            type="month"
            required
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
          <Select
            label="Quantidade"
            options={OPCOES_MESES}
            value={meses}
            onChange={(e) => setMeses(e.target.value)}
          />
        </div>
        {semValor ? (
          <p role="alert" className={styles.aviso}>
            Defina o valor mensal na aba Assinatura antes de gerar as cobranças.
          </p>
        ) : (
          <p className={styles.hint}>
            Cada uma com {moeda(billing.valorMensal)}, vencendo no dia {billing.diaVencimento} do
            mês (ou no último dia, se o mês for mais curto). Os boletos você anexa depois.
          </p>
        )}
        {novas.length > 0 && (
          <ul className={styles.previa} aria-label="Cobranças que serão criadas">
            {novas.map((ref) => (
              <li key={ref}>
                <strong>{mesAno(ref)}</strong>
                <span>vence {dataBr(vencimentoDoMes(ref, billing.diaVencimento))}</span>
              </li>
            ))}
          </ul>
        )}
        {puladas.length > 0 && (
          <p className={styles.hint}>
            Já existem e serão mantidas: {puladas.map(mesAno).join(', ')}.
          </p>
        )}
      </div>
    </Modal>
  );
}

function EnviarModal({
  cobranca,
  config,
  onClose,
}: {
  cobranca: CobrancaDTO;
  config: CobrancaConfigDTO | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [mensagem, setMensagem] = useState('');
  const semConfig =
    !config || !config.smtp.host || !config.smtp.fromEmail || config.emails.length === 0;
  const mutation = useMutation({
    mutationFn: () =>
      enviarCobranca(cobranca.id, mensagem.trim() ? { mensagem: mensagem.trim() } : {}),
    onSuccess: () => {
      showToast('Boleto enviado por e-mail.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível enviar.', 'danger'),
  });
  return (
    <Modal
      open
      title={`Enviar boleto de ${mesAno(cobranca.referencia)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={semConfig}
          >
            {cobranca.enviadoEm ? 'Reenviar e-mail' : 'Enviar e-mail'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {semConfig ? (
          <p role="alert" className={styles.erro}>
            Configure o SMTP de cobrança e ao menos um e-mail do cliente antes de enviar (botão
            "Configurar e-mail").
          </p>
        ) : (
          <dl className={styles.resumo}>
            <div>
              <dt>Para</dt>
              <dd>{config.emails.join(', ')}</dd>
            </div>
            <div>
              <dt>Cópia oculta</dt>
              <dd>{config.copiaOculta || '—'}</dd>
            </div>
            <div>
              <dt>Anexo</dt>
              <dd>
                {cobranca.arquivoNome} · {tamanho(cobranca.arquivoTamanho)}
              </dd>
            </div>
            <div>
              <dt>Valor / vencimento</dt>
              <dd>
                {moeda(cobranca.valor)} · {dataBr(cobranca.vencimento)}
              </dd>
            </div>
          </dl>
        )}
        <Input
          label="Mensagem adicional (opcional)"
          maxLength={1000}
          placeholder="Aparece no corpo do e-mail, acima da assinatura."
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
        />
        {cobranca.enviadoEm && (
          <p className={styles.hint}>
            Último envio: {new Date(cobranca.enviadoEm).toLocaleString('pt-BR')} ({cobranca.envios}{' '}
            envio(s)).
          </p>
        )}
      </div>
    </Modal>
  );
}

function ConfigModal({ config, onClose }: { config: CobrancaConfigDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [emails, setEmails] = useState(config.emails.join(', '));
  const [copiaOculta, setCopiaOculta] = useState(config.copiaOculta);
  const [smtp, setSmtp] = useState(config.smtp);
  const [lembretes, setLembretes] = useState(config.lembretes);
  const [destinoTeste, setDestinoTeste] = useState(config.copiaOculta || config.smtp.fromEmail);
  const listaEmails = emails
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const emailInvalido =
    listaEmails.some((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) ||
    (copiaOculta !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(copiaOculta));

  const salvar = useMutation({
    mutationFn: () => saveCobrancaConfig({ emails: listaEmails, copiaOculta, smtp, lembretes }),
    onSuccess: () => {
      showToast('E-mail de cobrança salvo.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['cobranca-config'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'danger'),
  });
  const testar = useMutation({
    mutationFn: async () => {
      // O teste usa o que está salvo: grava antes para testar exatamente estas configurações.
      await saveCobrancaConfig({ emails: listaEmails, copiaOculta, smtp, lembretes });
      return testarCobrancaSmtp(destinoTeste);
    },
    onSuccess: (resultado) => showToast(resultado.message, resultado.ok ? 'success' : 'danger'),
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível testar.', 'danger'),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!emailInvalido) salvar.mutate();
  }

  return (
    <Modal
      open
      title="E-mail de cobrança"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-cobranca-config"
            loading={salvar.isPending}
            disabled={emailInvalido}
          >
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-cobranca-config" onSubmit={submit} className={styles.form}>
        <fieldset className={styles.grupo}>
          <legend>Quem recebe</legend>
          <Input
            label="E-mails do cliente (separe por vírgula)"
            placeholder="financeiro@cliente.com.br"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
          <Input
            label="Cópia oculta (você)"
            type="email"
            placeholder="contato.rodriguestech@gmail.com"
            value={copiaOculta}
            onChange={(e) => setCopiaOculta(e.target.value)}
          />
        </fieldset>
        <fieldset className={styles.grupo}>
          <legend>De onde sai (SMTP seu, escondido do cliente)</legend>
          <Input
            label="Servidor SMTP"
            placeholder="smtp.gmail.com"
            value={smtp.host}
            onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
          />
          <Input
            label="Porta"
            type="number"
            value={smtp.port}
            onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
          />
          <Select
            label="Segurança"
            options={SEGURANCA}
            value={smtp.seguranca}
            onChange={(e) =>
              setSmtp({
                ...smtp,
                seguranca: e.target.value as CobrancaConfigDTO['smtp']['seguranca'],
              })
            }
          />
          <Input
            label="Usuário"
            autoComplete="off"
            value={smtp.user}
            onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
          />
          <PasswordInput
            label="Senha (de aplicativo)"
            autoComplete="new-password"
            placeholder={smtp.password === '••••••••' ? 'Senha salva — digite só para trocar' : ''}
            value={smtp.password === '••••••••' ? '' : smtp.password}
            onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
          />
          <Input
            label="Nome do remetente"
            value={smtp.fromName}
            onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
          />
          <Input
            label="E-mail do remetente"
            type="email"
            value={smtp.fromEmail}
            onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
          />
        </fieldset>
        <fieldset className={styles.grupo}>
          <legend>Lembretes automáticos</legend>
          <Checkbox
            label="Enviar lembrete ao cliente antes do vencimento"
            hint="Só para boletos com PDF anexado e ainda não pagos. Não repete se você já enviou nesses dias."
            checked={lembretes.ativo}
            onChange={(e) => setLembretes({ ...lembretes, ativo: e.target.checked })}
          />
          <Input
            label="Quantos dias antes"
            type="number"
            min={0}
            max={15}
            disabled={!lembretes.ativo}
            value={lembretes.diasAntes}
            onChange={(e) =>
              setLembretes({
                ...lembretes,
                diasAntes: Math.min(15, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
          <Checkbox
            label="Avisar também quando vencer sem pagamento"
            hint="Um aviso só, até 15 dias depois do vencimento."
            disabled={!lembretes.ativo}
            checked={lembretes.aposVencimento}
            onChange={(e) => setLembretes({ ...lembretes, aposVencimento: e.target.checked })}
          />
        </fieldset>
        <div className={styles.teste}>
          <Input
            label="Enviar e-mail de teste para"
            type="email"
            value={destinoTeste}
            onChange={(e) => setDestinoTeste(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={testar.isPending}
            disabled={!destinoTeste || !smtp.host || emailInvalido}
            onClick={() => testar.mutate()}
          >
            Salvar e testar
          </Button>
        </div>
        {emailInvalido && (
          <p role="alert" className={styles.erro}>
            Confira os e-mails: algum está inválido.
          </p>
        )}
      </form>
    </Modal>
  );
}

type Dialogo =
  | { tipo: 'nova' }
  | { tipo: 'gerar' }
  | { tipo: 'config' }
  | { tipo: 'editar'; cobranca: CobrancaDTO }
  | { tipo: 'anexar'; cobranca: CobrancaDTO }
  | { tipo: 'enviar'; cobranca: CobrancaDTO }
  | null;

const FILTROS: { key: FiltroCobranca; label: string; vazio: string }[] = [
  { key: 'abertas', label: 'Em aberto', vazio: 'Nenhuma cobrança em aberto.' },
  { key: 'vencidas', label: 'Vencidas', vazio: 'Nenhuma cobrança vencida.' },
  { key: 'semBoleto', label: 'Sem boleto', vazio: 'Todas as cobranças em aberto já têm o PDF.' },
  { key: 'pagas', label: 'Pagas', vazio: 'Nenhuma baixa registrada ainda.' },
  { key: 'todas', label: 'Todas', vazio: 'Nenhuma cobrança.' },
];

export function CobrancasCard({
  billing,
  onPagar,
}: {
  billing: BillingDTO;
  onPagar: (cobranca: CobrancaDTO) => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [remover, setRemover] = useState<CobrancaDTO | null>(null);
  const [estornar, setEstornar] = useState<CobrancaDTO | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroCobranca>('abertas');
  const configQuery = useQuery({ queryKey: ['cobranca-config'], queryFn: getCobrancaConfig });
  const config = configQuery.data;
  const pronto = Boolean(
    config && config.smtp.host && config.smtp.fromEmail && config.emails.length > 0,
  );
  const hoje = hojeLocal();
  const contagem = contarFiltros(billing.cobrancas, hoje);
  const lista = filtrarCobrancas(billing.cobrancas, filtro, hoje);

  const removeMutation = useMutation({
    mutationFn: (cobranca: CobrancaDTO) => removerCobranca(cobranca.id),
    onSuccess: () => {
      setRemover(null);
      showToast('Cobrança removida.', 'success');
      invalidarCobrancas(queryClient);
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível remover.', 'danger'),
  });

  const estornoMutation = useMutation({
    mutationFn: (cobranca: CobrancaDTO) => desfazerBaixa(cobranca.id),
    onSuccess: (resultado) => {
      setEstornar(null);
      showToast(
        resultado.vencimentoRestaurado
          ? `Baixa desfeita. Vencimento voltou para ${dataBr(resultado.vencimentoAtual)}.`
          : 'Baixa desfeita. Confira o vencimento na aba Assinatura.',
        'success',
      );
      invalidarCobrancas(queryClient);
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : 'Não foi possível desfazer.', 'danger'),
  });

  async function baixar(cobranca: CobrancaDTO) {
    if (!cobranca.arquivoNome) return;
    setBaixando(cobranca.id);
    try {
      salvarBlobComoArquivo(await baixarCobranca(cobranca.id), cobranca.arquivoNome);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível baixar o PDF.', 'danger');
    } finally {
      setBaixando(null);
    }
  }

  function exportar() {
    const blob = new Blob([cobrancasCsv(billing.cobrancas, hoje)], {
      type: 'text/csv;charset=utf-8',
    });
    salvarBlobComoArquivo(blob, `contas-a-receber-${hoje}.csv`);
  }

  function maisAcoes(cobranca: CobrancaDTO): RowActionItem[] {
    const itens: RowActionItem[] = [];
    if (!cobranca.pagoEm) {
      itens.push({
        key: 'editar',
        label: 'Editar',
        icon: 'edit',
        onSelect: () => setDialogo({ tipo: 'editar', cobranca }),
      });
    }
    if (cobranca.arquivoNome) {
      // Pago: o botão Baixar PDF já fica visível na linha.
      if (!cobranca.pagoEm) {
        itens.push({
          key: 'pdf',
          label: 'Baixar PDF',
          icon: 'pdf',
          onSelect: () => baixar(cobranca),
        });
      }
      itens.push({
        key: 'trocar',
        label: 'Trocar PDF',
        icon: 'export',
        onSelect: () => setDialogo({ tipo: 'anexar', cobranca }),
      });
    }
    if (cobranca.pagoEm) {
      itens.push({
        key: 'estornar',
        label: 'Desfazer baixa',
        icon: 'history',
        onSelect: () => setEstornar(cobranca),
      });
    }
    itens.push({
      key: 'remover',
      label: 'Remover',
      icon: 'delete',
      danger: true,
      separar: true,
      onSelect: () => setRemover(cobranca),
    });
    return itens;
  }

  const filtroAtual = FILTROS.find((item) => item.key === filtro)!;

  return (
    <Card elevated className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3>Boletos da mensalidade</h3>
          <p className={styles.hint}>
            Deixe as cobranças criadas, anexe o boleto do Banco Inter quando tiver e envie por
            e-mail ao cliente.
          </p>
        </div>
        <div className={styles.headActions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDialogo({ tipo: 'config' })}
            disabled={!config}
          >
            <ActionIcon name="mail" /> Configurar e-mail
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={exportar}
            disabled={billing.cobrancas.length === 0}
          >
            <ActionIcon name="excel" /> Exportar CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDialogo({ tipo: 'gerar' })}>
            <ActionIcon name="calendar" /> Gerar meses
          </Button>
          <Button size="sm" onClick={() => setDialogo({ tipo: 'nova' })}>
            <ActionIcon name="add" /> Nova cobrança
          </Button>
        </div>
      </div>

      {configQuery.isLoading ? (
        <Skeleton height={20} />
      ) : (
        <p className={pronto ? styles.hint : styles.aviso} role="status">
          {pronto ? (
            <>
              Envia para <strong>{config!.emails.join(', ')}</strong>
              {config!.copiaOculta ? <> · cópia oculta para {config!.copiaOculta}</> : null}
              {config!.lembretes.ativo ? (
                <>
                  {' '}
                  · lembrete automático {config!.lembretes.diasAntes} dia(s) antes
                  {config!.lembretes.aposVencimento ? ' e após vencer' : ''}
                </>
              ) : null}
              .
            </>
          ) : (
            'E-mail de cobrança ainda não configurado: defina o SMTP e os e-mails do cliente em "Configurar e-mail".'
          )}
        </p>
      )}

      {billing.cobrancas.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <ActionIcon name="receipt" size={25} />
          </span>
          <strong>Nenhuma cobrança ainda</strong>
          <p>
            Use “Gerar meses” para deixar os próximos meses prontos de uma vez, ou “Nova cobrança”
            para um mês só. O PDF do boleto pode ser anexado depois.
          </p>
        </div>
      ) : (
        <div className={styles.filtros}>
          <div className={styles.filtroBotoes} role="group" aria-label="Filtrar cobranças">
            {FILTROS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filtro === item.key}
                className={`${styles.filtroBotao} ${filtro === item.key ? styles.filtroAtivo : ''}`}
                onClick={() => setFiltro(item.key)}
              >
                {item.label} <span className={styles.filtroContagem}>{contagem[item.key]}</span>
              </button>
            ))}
          </div>
          {lista.length === 0 ? (
            <p className={styles.vazioFiltro}>{filtroAtual.vazio}</p>
          ) : (
            <ul className={styles.lista}>
              {lista.map((cobranca) => {
                const sit = situacao(cobranca);
                return (
                  <li key={cobranca.id} className={styles.item}>
                    <div className={styles.itemInfo}>
                      <strong>
                        {mesAno(cobranca.referencia)} · {moeda(cobranca.valor)}
                      </strong>
                      <small>
                        Vence em {dataBr(cobranca.vencimento)}
                        {cobranca.arquivoNome
                          ? ` · ${cobranca.arquivoNome} (${tamanho(cobranca.arquivoTamanho)})`
                          : ''}
                        {cobranca.observacao ? ` · ${cobranca.observacao}` : ''}
                      </small>
                      <Badge tone={sit.tom} className={styles.statusBadge}>
                        <span aria-hidden="true">{sit.icone} </span>
                        {sit.texto}
                      </Badge>
                      {cobranca.lembretes.length > 0 && !cobranca.pagoEm && (
                        <small>
                          Lembrete automático enviado
                          {cobranca.lembretes.includes('VENCIDA') ? ' (inclusive após vencer)' : ''}
                          .
                        </small>
                      )}
                    </div>
                    <div className={styles.itemAcoes}>
                      {!cobranca.pagoEm && !cobranca.arquivoNome && (
                        <Button size="sm" onClick={() => setDialogo({ tipo: 'anexar', cobranca })}>
                          <ActionIcon name="pdf" /> Anexar boleto
                        </Button>
                      )}
                      {!cobranca.pagoEm && cobranca.arquivoNome && (
                        <Button size="sm" onClick={() => setDialogo({ tipo: 'enviar', cobranca })}>
                          <ActionIcon name="mail" />{' '}
                          {cobranca.enviadoEm ? 'Reenviar' : 'Enviar e-mail'}
                        </Button>
                      )}
                      {!cobranca.pagoEm && (
                        <Button variant="secondary" size="sm" onClick={() => onPagar(cobranca)}>
                          <ActionIcon name="ready" /> Dar baixa
                        </Button>
                      )}
                      {cobranca.pagoEm && cobranca.arquivoNome && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={baixando === cobranca.id}
                          onClick={() => void baixar(cobranca)}
                        >
                          <ActionIcon name="pdf" /> Baixar PDF
                        </Button>
                      )}
                      <RowActionsMenu
                        label={`Mais ações da cobrança de ${mesAno(cobranca.referencia)}`}
                        items={maisAcoes(cobranca)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {dialogo?.tipo === 'nova' && (
        <CobrancaModal billing={billing} onClose={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'editar' && (
        <CobrancaModal
          billing={billing}
          cobranca={dialogo.cobranca}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'gerar' && (
        <GerarModal billing={billing} onClose={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'anexar' && (
        <AnexarModal cobranca={dialogo.cobranca} onClose={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'config' && config && (
        <ConfigModal config={config} onClose={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'enviar' && (
        <EnviarModal cobranca={dialogo.cobranca} config={config} onClose={() => setDialogo(null)} />
      )}
      <ConfirmDialog
        open={remover !== null}
        title="Remover cobrança"
        danger
        description={
          remover
            ? remover.pagoEm
              ? `O boleto de ${mesAno(remover.referencia)} já está pago. Remover apaga a cobrança e o PDF, mas o pagamento continua no histórico da assinatura. Para corrigir uma baixa errada, use "Desfazer baixa".`
              : `Remover a cobrança de ${mesAno(remover.referencia)}?${remover.arquivoNome ? ' O PDF é apagado do servidor.' : ''}`
            : ''
        }
        confirmLabel="Remover"
        loading={removeMutation.isPending}
        onConfirm={() => remover && removeMutation.mutate(remover)}
        onCancel={() => setRemover(null)}
      />
      <ConfirmDialog
        open={estornar !== null}
        title="Desfazer baixa"
        description={
          estornar
            ? `O boleto de ${mesAno(estornar.referencia)} volta a ficar em aberto e o pagamento sai do histórico. Se foi a última baixa registrada, o vencimento da assinatura volta para a data anterior.`
            : ''
        }
        confirmLabel="Desfazer baixa"
        loading={estornoMutation.isPending}
        onConfirm={() => estornar && estornoMutation.mutate(estornar)}
        onCancel={() => setEstornar(null)}
      />
    </Card>
  );
}
