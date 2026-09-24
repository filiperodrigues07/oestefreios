import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import {
  baixarCobranca,
  criarCobranca,
  enviarCobranca,
  getCobrancaConfig,
  getCobrancaSmtpPassword,
  removerCobranca,
  saveCobrancaConfig,
  testarCobrancaSmtp,
} from '../../api/billing.api.js';
import { salvarBlobComoArquivo } from '../../api/httpClient.js';
import { Badge, Button, Card, ConfirmDialog, Input, Modal, PasswordInput, Select, Skeleton, useToast, type BadgeTone } from '../../components/ui/index.js';
import type { BillingDTO, CobrancaConfigDTO, CobrancaDTO } from '../../types/billing.types.js';
import { dataBr, hojeLocal, mesAno, moeda } from './formatos.js';
import styles from './CobrancasCard.module.css';

const SEGURANCA = [
  { value: 'starttls', label: 'STARTTLS (587)' },
  { value: 'ssl', label: 'SSL/TLS (465)' },
  { value: 'nenhuma', label: 'Nenhuma' },
];

function situacao(cobranca: CobrancaDTO): { texto: string; tom: BadgeTone; icone: string } {
  if (cobranca.pagoEm) return { texto: `Paga em ${dataBr(cobranca.pagoEm)}`, tom: 'success', icone: '✓' };
  const vencida = cobranca.vencimento < hojeLocal();
  if (cobranca.enviadoEm) {
    return { texto: `Enviada em ${dataBr(cobranca.enviadoEm)} para ${cobranca.enviadoPara.length} e-mail(s)${vencida ? ' · vencida' : ''}`, tom: vencida ? 'danger' : 'primary', icone: vencida ? '!' : '✉' };
  }
  return { texto: vencida ? 'Vencida, sem envio' : 'Aguardando envio', tom: vencida ? 'danger' : 'warning', icone: '!' };
}

const tamanho = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function NovaCobrancaModal({ billing, onClose }: { billing: BillingDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [referencia, setReferencia] = useState((billing.vencimentoAtual ?? hojeLocal()).slice(0, 7));
  const [vencimento, setVencimento] = useState(billing.vencimentoAtual ?? hojeLocal());
  const [valor, setValor] = useState(String(billing.valorMensal));
  const [observacao, setObservacao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: criarCobranca,
    onSuccess: () => {
      showToast('Boleto anexado.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      onClose();
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível anexar.', 'danger'),
  });

  function escolher(file: File | null) {
    setErroArquivo(null);
    if (file && file.size > 5 * 1024 * 1024) {
      setArquivo(null);
      setErroArquivo('O PDF pode ter no máximo 5 MB.');
      return;
    }
    if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setArquivo(null);
      setErroArquivo('Escolha o boleto em PDF.');
      return;
    }
    setArquivo(file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!arquivo) {
      setErroArquivo('Anexe o PDF do boleto.');
      return;
    }
    mutation.mutate({ referencia, vencimento, valor: Number(valor), observacao, arquivo });
  }

  return <Modal open title="Nova cobrança (boleto)" onClose={onClose} footer={<>
    <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
    <Button type="submit" form="form-cobranca" loading={mutation.isPending}>Anexar boleto</Button>
  </>}>
    <form id="form-cobranca" onSubmit={submit} className={styles.form}>
      <Input label="Mês de referência" type="month" required value={referencia} onChange={e => setReferencia(e.target.value)} />
      <Input label="Vencimento do boleto" type="date" required value={vencimento} onChange={e => setVencimento(e.target.value)} />
      <Input label="Valor (R$)" type="number" step="0.01" min="0" required value={valor} onChange={e => setValor(e.target.value)} />
      <Input label="Observação (opcional)" maxLength={300} value={observacao} onChange={e => setObservacao(e.target.value)} />
      <div className={styles.arquivo}>
        <label htmlFor="arquivo-boleto" className={styles.arquivoLabel}>Boleto em PDF (Banco Inter) <span aria-hidden="true">*</span></label>
        <input id="arquivo-boleto" type="file" accept="application/pdf,.pdf" required onChange={e => escolher(e.target.files?.[0] ?? null)} />
        {arquivo && <small className={styles.hint}>{arquivo.name} · {tamanho(arquivo.size)}</small>}
        {erroArquivo && <small role="alert" className={styles.erro}>{erroArquivo}</small>}
      </div>
    </form>
  </Modal>;
}

function EnviarModal({ cobranca, config, onClose }: { cobranca: CobrancaDTO; config: CobrancaConfigDTO | undefined; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [mensagem, setMensagem] = useState('');
  const semConfig = !config || !config.smtp.host || !config.smtp.fromEmail || config.emails.length === 0;
  const mutation = useMutation({
    mutationFn: () => enviarCobranca(cobranca.id, mensagem.trim() ? { mensagem: mensagem.trim() } : {}),
    onSuccess: () => {
      showToast('Boleto enviado por e-mail.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      onClose();
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível enviar.', 'danger'),
  });
  return <Modal open title={`Enviar boleto de ${mesAno(cobranca.referencia)}`} onClose={onClose} footer={<>
    <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
    <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={semConfig}>{cobranca.enviadoEm ? 'Reenviar e-mail' : 'Enviar e-mail'}</Button>
  </>}>
    <div className={styles.form}>
      {semConfig
        ? <p role="alert" className={styles.erro}>Configure o SMTP de cobrança e ao menos um e-mail do cliente antes de enviar (botão "Configurar e-mail").</p>
        : <dl className={styles.resumo}>
          <div><dt>Para</dt><dd>{config.emails.join(', ')}</dd></div>
          <div><dt>Cópia oculta</dt><dd>{config.copiaOculta || '—'}</dd></div>
          <div><dt>Anexo</dt><dd>{cobranca.arquivoNome} · {tamanho(cobranca.arquivoTamanho)}</dd></div>
          <div><dt>Valor / vencimento</dt><dd>{moeda(cobranca.valor)} · {dataBr(cobranca.vencimento)}</dd></div>
        </dl>}
      <Input label="Mensagem adicional (opcional)" maxLength={1000} placeholder="Aparece no corpo do e-mail, acima da assinatura." value={mensagem} onChange={e => setMensagem(e.target.value)} />
      {cobranca.enviadoEm && <p className={styles.hint}>Último envio: {new Date(cobranca.enviadoEm).toLocaleString('pt-BR')} ({cobranca.envios} envio(s)).</p>}
    </div>
  </Modal>;
}

function ConfigModal({ config, onClose }: { config: CobrancaConfigDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [emails, setEmails] = useState(config.emails.join(', '));
  const [copiaOculta, setCopiaOculta] = useState(config.copiaOculta);
  const [smtp, setSmtp] = useState(config.smtp);
  const [destinoTeste, setDestinoTeste] = useState(config.copiaOculta || config.smtp.fromEmail);
  const listaEmails = emails.split(/[,;\s]+/).map(item => item.trim()).filter(Boolean);
  const emailInvalido = listaEmails.some(item => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) || (copiaOculta !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(copiaOculta));

  const salvar = useMutation({
    mutationFn: () => saveCobrancaConfig({ emails: listaEmails, copiaOculta, smtp }),
    onSuccess: () => {
      showToast('E-mail de cobrança salvo.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['cobranca-config'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      onClose();
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'danger'),
  });
  const testar = useMutation({
    mutationFn: async () => {
      // O teste usa o que está salvo: grava antes para testar exatamente estas configurações.
      await saveCobrancaConfig({ emails: listaEmails, copiaOculta, smtp });
      return testarCobrancaSmtp(destinoTeste);
    },
    onSuccess: resultado => showToast(resultado.message, resultado.ok ? 'success' : 'danger'),
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível testar.', 'danger'),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!emailInvalido) salvar.mutate();
  }

  return <Modal open title="E-mail de cobrança" onClose={onClose} footer={<>
    <Button variant="secondary" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
    <Button type="submit" form="form-cobranca-config" loading={salvar.isPending} disabled={emailInvalido}>Salvar</Button>
  </>}>
    <form id="form-cobranca-config" onSubmit={submit} className={styles.form}>
      <fieldset className={styles.grupo}>
        <legend>Quem recebe</legend>
        <Input label="E-mails do cliente (separe por vírgula)" placeholder="financeiro@cliente.com.br" value={emails} onChange={e => setEmails(e.target.value)} />
        <Input label="Cópia oculta (você)" type="email" placeholder="contato.rodriguestech@gmail.com" value={copiaOculta} onChange={e => setCopiaOculta(e.target.value)} />
      </fieldset>
      <fieldset className={styles.grupo}>
        <legend>De onde sai (SMTP seu, escondido do cliente)</legend>
        <Input label="Servidor SMTP" placeholder="smtp.gmail.com" value={smtp.host} onChange={e => setSmtp({ ...smtp, host: e.target.value })} />
        <Input label="Porta" type="number" value={smtp.port} onChange={e => setSmtp({ ...smtp, port: Number(e.target.value) })} />
        <Select label="Segurança" options={SEGURANCA} value={smtp.seguranca} onChange={e => setSmtp({ ...smtp, seguranca: e.target.value as CobrancaConfigDTO['smtp']['seguranca'] })} />
        <Input label="Usuário" autoComplete="off" value={smtp.user} onChange={e => setSmtp({ ...smtp, user: e.target.value })} />
        <PasswordInput
          label="Senha (de aplicativo)"
          copyable
          autoComplete="new-password"
          placeholder={smtp.password === '••••••••' ? '••••••••' : ''}
          value={smtp.password === '••••••••' ? '' : smtp.password}
          onChange={e => setSmtp({ ...smtp, password: e.target.value })}
          onReveal={async () => {
            const { password } = await getCobrancaSmtpPassword();
            setSmtp(atual => ({ ...atual, password }));
            return password;
          }}
        />
        <Input label="Nome do remetente" value={smtp.fromName} onChange={e => setSmtp({ ...smtp, fromName: e.target.value })} />
        <Input label="E-mail do remetente" type="email" value={smtp.fromEmail} onChange={e => setSmtp({ ...smtp, fromEmail: e.target.value })} />
      </fieldset>
      <div className={styles.teste}>
        <Input label="Enviar e-mail de teste para" type="email" value={destinoTeste} onChange={e => setDestinoTeste(e.target.value)} />
        <Button type="button" variant="secondary" size="sm" loading={testar.isPending} disabled={!destinoTeste || !smtp.host || emailInvalido} onClick={() => testar.mutate()}>Salvar e testar</Button>
      </div>
      {emailInvalido && <p role="alert" className={styles.erro}>Confira os e-mails: algum está inválido.</p>}
    </form>
  </Modal>;
}

type Dialogo = { tipo: 'nova' } | { tipo: 'config' } | { tipo: 'enviar'; cobranca: CobrancaDTO } | null;

export function CobrancasCard({ billing, onPagar }: { billing: BillingDTO; onPagar: (cobranca: CobrancaDTO) => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [remover, setRemover] = useState<CobrancaDTO | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const configQuery = useQuery({ queryKey: ['cobranca-config'], queryFn: getCobrancaConfig });
  const config = configQuery.data;
  const pronto = Boolean(config && config.smtp.host && config.smtp.fromEmail && config.emails.length > 0);

  const removeMutation = useMutation({
    mutationFn: (cobranca: CobrancaDTO) => removerCobranca(cobranca.id),
    onSuccess: () => {
      setRemover(null);
      showToast('Cobrança removida.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível remover.', 'danger'),
  });

  async function baixar(cobranca: CobrancaDTO) {
    setBaixando(cobranca.id);
    try {
      salvarBlobComoArquivo(await baixarCobranca(cobranca.id), cobranca.arquivoNome);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível baixar o PDF.', 'danger');
    } finally {
      setBaixando(null);
    }
  }

  return <Card elevated className={styles.card}>
    <div className={styles.head}>
      <div>
        <h3>Cobranças (boletos)</h3>
        <p className={styles.hint}>Anexe o boleto do Banco Inter de cada mês e envie por e-mail ao cliente.</p>
      </div>
      <div className={styles.headActions}>
        <Button variant="secondary" size="sm" onClick={() => setDialogo({ tipo: 'config' })} disabled={!config}>Configurar e-mail</Button>
        <Button size="sm" onClick={() => setDialogo({ tipo: 'nova' })}>Nova cobrança</Button>
      </div>
    </div>

    {configQuery.isLoading
      ? <Skeleton height={20} />
      : <p className={pronto ? styles.hint : styles.aviso} role="status">
        {pronto
          ? <>Envia para <strong>{config!.emails.join(', ')}</strong>{config!.copiaOculta ? <> · cópia oculta para {config!.copiaOculta}</> : null}.</>
          : 'E-mail de cobrança ainda não configurado: defina o SMTP e os e-mails do cliente em "Configurar e-mail".'}
      </p>}

    {billing.cobrancas.length === 0
      ? <p className={styles.hint}>Nenhuma cobrança anexada ainda.</p>
      : <ul className={styles.lista}>{billing.cobrancas.map(cobranca => {
        const sit = situacao(cobranca);
        return <li key={cobranca.id} className={styles.item}>
          <div className={styles.itemInfo}>
            <strong>{mesAno(cobranca.referencia)} · {moeda(cobranca.valor)}</strong>
            <small>Vence em {dataBr(cobranca.vencimento)} · {cobranca.arquivoNome} ({tamanho(cobranca.arquivoTamanho)})</small>
            <Badge tone={sit.tom}><span aria-hidden="true">{sit.icone} </span>{sit.texto}</Badge>
          </div>
          <div className={styles.itemAcoes}>
            <Button variant="secondary" size="sm" loading={baixando === cobranca.id} onClick={() => void baixar(cobranca)}>Baixar PDF</Button>
            {!cobranca.pagoEm && <Button size="sm" onClick={() => setDialogo({ tipo: 'enviar', cobranca })}>{cobranca.enviadoEm ? 'Reenviar' : 'Enviar e-mail'}</Button>}
            {!cobranca.pagoEm && <Button variant="secondary" size="sm" onClick={() => onPagar(cobranca)}>Registrar pagamento</Button>}
            <Button variant="ghost" size="sm" onClick={() => setRemover(cobranca)}>Remover</Button>
          </div>
        </li>;
      })}</ul>}

    {dialogo?.tipo === 'nova' && <NovaCobrancaModal billing={billing} onClose={() => setDialogo(null)} />}
    {dialogo?.tipo === 'config' && config && <ConfigModal config={config} onClose={() => setDialogo(null)} />}
    {dialogo?.tipo === 'enviar' && <EnviarModal cobranca={dialogo.cobranca} config={config} onClose={() => setDialogo(null)} />}
    <ConfirmDialog open={remover !== null} title="Remover cobrança" danger
      description={remover ? `Remover o boleto de ${mesAno(remover.referencia)}? O PDF é apagado do servidor. Pagamentos já registrados não mudam.` : ''}
      confirmLabel="Remover" loading={removeMutation.isPending}
      onConfirm={() => remover && removeMutation.mutate(remover)} onCancel={() => setRemover(null)} />
  </Card>;
}
