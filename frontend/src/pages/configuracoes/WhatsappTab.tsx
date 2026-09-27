import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createWhatsappInstance, getWhatsappConnection, getWhatsappQr, getWhatsappSettings, saveWhatsappSettings, type AutomaticMessageType, type OsMessageType, type WhatsappSettings } from '../../api/settings.api.js';
import { ActionIcon, Badge, Button, Card, ErrorState, Input, PasswordInput, Skeleton, useToast } from '../../components/ui/index.js';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard.js';
import { getUserErrorMessage } from '../../utils/errorPresentation.js';
import configStyles from '../ConfiguracoesPage.module.css';
import styles from './WhatsappTab.module.css';

const TYPES: { key: OsMessageType; label: string }[] = [
  { key: 'aberta', label: 'OS aberta' },
  { key: 'aguardando_cliente', label: 'Aguardando retorno do cliente' },
  { key: 'aguardando_peca', label: 'Aguardando peças' },
  { key: 'pronta', label: 'OS pronta' },
  { key: 'resumo_financeiro', label: 'Resumo financeiro' },
];

export function WhatsappTab() {
  const settingsQuery = useQuery({ queryKey: ['settings', 'whatsapp'], queryFn: getWhatsappSettings });
  if (settingsQuery.isError) return <ErrorState error={settingsQuery.error} action={<Button onClick={() => settingsQuery.refetch()}>Tentar novamente</Button>} />;
  if (!settingsQuery.data) return <Card className={styles.loading}><Skeleton height={40} /><Skeleton height={40} /><Skeleton height={40} /></Card>;
  return <WhatsappEditor initial={settingsQuery.data} />;
}

function WhatsappEditor({ initial }: { initial: WhatsappSettings }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WhatsappSettings>(initial);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const guard = useUnsavedChangesGuard(dirty, { incluirQuery: true });
  const connectionQuery = useQuery({
    queryKey: ['settings', 'whatsapp', 'status'], queryFn: getWhatsappConnection,
    enabled: !!initial.baseUrl && !!initial.apiKey,
    retry: false, staleTime: 10_000,
  });
  const save = useMutation({
    mutationFn: saveWhatsappSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings', 'whatsapp'], data);
      setForm(data);
      void connectionQuery.refetch();
      showToast('Configurações do WhatsApp salvas.', 'success');
    },
    onError: (error) => showToast(getUserErrorMessage(error, 'Não foi possível salvar o WhatsApp.'), 'danger'),
  });
  const qr = useMutation({
    mutationFn: getWhatsappQr,
    onError: (error) => showToast(getUserErrorMessage(error, 'Não foi possível gerar o QR Code.'), 'danger'),
  });
  const create = useMutation({
    mutationFn: createWhatsappInstance,
    onSuccess: () => { showToast('Instância criada. Gere o QR Code para conectar.', 'success'); void connectionQuery.refetch(); },
    onError: (error) => showToast(getUserErrorMessage(error, 'Não foi possível criar a instância.'), 'danger'),
  });

  const state = connectionQuery.data?.state;
  const status = state === 'open' ? 'Conectado' : connectionQuery.isFetching ? 'Verificando' : connectionQuery.isError ? 'Sem conexão' : state ? 'Desconectado' : 'Não configurado';
  const statusTone = state === 'open' ? 'success' : connectionQuery.isError ? 'danger' : state ? 'warning' : 'neutral';

  return <div className={styles.page}>
    <section className={`${configStyles.connectionCard} ${styles.card}`}>
      <div className={configStyles.cardHeading}>
        <img className={styles.brandMark} src="/whatsapp-glyph-green.svg" alt="" />
        <div><h2>Conexão com o WhatsApp</h2><p>Configure o número da oficina pela Evolution API.</p></div>
      </div>
      <div className={styles.statusRow} role="status">
        <span>Estado da conexão</span><Badge tone={statusTone}>{status}</Badge>
      </div>
      <div className={configStyles.settingsSection}>
        <div className={configStyles.sectionIntro}><span>1</span><div><h3>Dados da integração</h3><p>Preencha com os dados da instalação da Evolution no servidor.</p></div></div>
        <div className={configStyles.fields}>
          <div className={configStyles.fullRow}>
            <Input label="Endereço da Evolution API" type="url" placeholder="http://127.0.0.1:8080" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} />
            <p>Se a Evolution e o backend estiverem no mesmo servidor, use <code>http://127.0.0.1:8080</code>. Este endereço é acessado pelo servidor, não pelo celular.</p>
          </div>
          <div>
            <Input label="Nome da instância" placeholder="oeste-freios" value={form.instanceName} onChange={(event) => setForm({ ...form, instanceName: event.target.value })} />
            <p>Escolha um nome para o WhatsApp da oficina. O padrão é <code>oeste-freios</code>.</p>
          </div>
          <div>
            <PasswordInput label="Chave da API" autoComplete="off" placeholder={form.apiKey ? 'Chave salva — digite só para trocar' : 'Chave configurada na Evolution'} value={form.apiKey === '••••••••' ? '' : form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} />
            <p>Use o mesmo valor de <code>EVOLUTION_API_KEY</code> definido no arquivo <code>deploy/evolution.env</code>.</p>
          </div>
        </div>
        <div className={configStyles.singleAction}><Button onClick={() => save.mutate(form)} loading={save.isPending} disabled={!form.baseUrl || !form.instanceName}>Salvar conexão</Button></div>
      </div>
      <div className={configStyles.settingsSection}>
        <div className={configStyles.sectionIntro}><span>2</span><div><h3>Conectar o aparelho</h3><p>Depois de salvar: crie a instância, gere o QR Code e escaneie com o celular da oficina.</p></div></div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => create.mutate()} loading={create.isPending} disabled={dirty || !form.baseUrl || !form.apiKey}>Criar instância</Button>
          <Button variant="secondary" onClick={() => qr.mutate()} loading={qr.isPending} disabled={dirty || !form.baseUrl || !form.apiKey}>Gerar QR Code</Button>
          <Button variant="secondary" onClick={() => connectionQuery.refetch()} loading={connectionQuery.isFetching} disabled={dirty || !form.baseUrl || !form.apiKey}>Verificar conexão</Button>
        </div>
        {connectionQuery.isError && <p className={styles.feedback} role="alert">{getUserErrorMessage(connectionQuery.error, 'Não foi possível verificar a conexão.')}</p>}
        {qr.data?.base64 && <div className={styles.qr}><img src={qr.data.base64} alt="QR Code para conectar o WhatsApp da oficina" /><p>No WhatsApp da oficina: Aparelhos conectados → Conectar aparelho.</p></div>}
        {qr.data?.pairingCode && <p className={styles.feedback}>Código de pareamento: <strong>{qr.data.pairingCode}</strong></p>}
        {!qr.data?.base64 && qr.isSuccess && <p className={styles.feedback} role="status">QR Code ainda indisponível. Verifique a conexão e tente novamente.</p>}
      </div>
    </section>

    <section className={`${configStyles.connectionCard} ${styles.card}`}>
      <div className={configStyles.cardHeading}>
        <span className={configStyles.iconTile}><ActionIcon name="mail" size={24} /></span>
        <div><h2>Mensagens da OS</h2><p>Personalize o texto enviado ao cliente em cada situação.</p></div>
      </div>
      <div className={styles.variables}>Variáveis disponíveis: <code>{'{cliente}'}</code> <code>{'{os}'}</code> <code>{'{veiculo}'}</code> <code>{'{status}'}</code>. No resumo financeiro: <code>{'{itens}'}</code> (produtos e serviços detalhados), <code>{'{produtos}'}</code>, <code>{'{servicos}'}</code> e <code>{'{total}'}</code>.</div>
      <div className={styles.variables}>Para destacar uma parte da mensagem no WhatsApp, use <code>*texto*</code>. No e-mail, ela aparece em negrito.</div>
      {TYPES.map(({ key, label }, index) => <div className={configStyles.settingsSection} key={key}>
        <div className={configStyles.sectionIntro}><span>{index + 1}</span><div><h3>{label}</h3><p>{key === 'resumo_financeiro' ? 'Envio manual pela OS.' : 'Texto para o envio manual ou automático.'}</p></div></div>
        <label className={configStyles.fieldLabel} htmlFor={`message-${key}`}>Texto da mensagem</label>
        <textarea className={styles.textarea} id={`message-${key}`} value={form.templates[key]} maxLength={1200} rows={3} onChange={(event) => setForm({ ...form, templates: { ...form.templates, [key]: event.target.value } })} />
        {key !== 'resumo_financeiro' && <div className={styles.switches}>
          <label><input type="checkbox" checked={form.automatic[key as AutomaticMessageType]} onChange={(event) => setForm({ ...form, automatic: { ...form.automatic, [key]: event.target.checked } })} /><span>Enviar WhatsApp ao mudar status</span></label>
          <label><input type="checkbox" checked={form.automaticEmail[key as AutomaticMessageType]} onChange={(event) => setForm({ ...form, automaticEmail: { ...form.automaticEmail, [key]: event.target.checked } })} /><span>Enviar e-mail ao mudar status</span></label>
        </div>}
      </div>)}
      <div className={configStyles.formFooter}><p>Envio automático desligado até você ativar. WhatsApp exige autorização do cliente.</p><Button onClick={() => save.mutate(form)} loading={save.isPending}>Salvar mensagens</Button></div>
    </section>
    {guard.dialog}
  </div>;
}
