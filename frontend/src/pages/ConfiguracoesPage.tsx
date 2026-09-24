import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { handleMutationError } from '../pwa/offlineErrorToast.js';
import {
  getFirebirdSettings,
  getFirebirdPassword,
  getFirebirdConnectionStatus,
  getGeralSettings,
  getIntegracoesSettings,
  getSmtpPassword,
  getSmtpSettings,
  getIntegrationSecret,
  saveFirebirdSettings,
  saveGeralSettings,
  saveIntegracoesSettings,
  saveSmtpSettings,
  testFirebirdSettings,
  testSmtpSettings,
  type FirebirdSettings,
  type GeralSettings,
  type IntegracoesSettings,
  type SmtpSettings,
} from '../api/settings.api.js';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  Modal,
  PasswordInput,
  Select,
  Skeleton,
  Tooltip,
  useToast,
} from '../components/ui/index.js';
import { NavIcon } from '../components/layout/NavIcon.js';
import { AuditoriaTab } from './configuracoes/AuditoriaTab.js';
import styles from './ConfiguracoesPage.module.css';

const CHARSET_OPTIONS = [
  { value: 'NONE', label: 'NONE (padrão)' },
  { value: 'WIN1252', label: 'WIN1252' },
  { value: 'UTF8', label: 'UTF8' },
  { value: 'ISO8859_1', label: 'ISO8859_1' },
];

const SEGURANCA_OPTIONS = [
  { value: 'nenhuma', label: 'Nenhuma' },
  { value: 'starttls', label: 'STARTTLS' },
  { value: 'ssl', label: 'SSL' },
];

interface TestFeedback {
  ok: boolean;
  message: string;
}

/** Mantém o rascunho local sincronizado quando uma nova versão chega da API. */
function useSettingsForm<T>(data: T | undefined) {
  const [form, setForm] = useState<T | null>(() => data ?? null);
  const [lastData, setLastData] = useState(data);
  if (data !== lastData) {
    setLastData(data);
    if (data !== undefined) setForm(data);
  }
  return [form, setForm] as const;
}

function SettingsIcon({
  name,
}: {
  name: 'database' | 'mail' | 'help' | 'refresh' | 'save' | 'link' | 'network' | 'plug' | 'book' | 'clock' | 'server' | 'check';
}) {
  const paths = {
    database: 'M4 6c0-4 16-4 16 0s-16 4-16 0Zm0 0v6c0 4 16 4 16 0V6M4 12v6c0 4 16 4 16 0v-6',
    mail: 'M3 5h18v14H3zM3 5l9 8 9-8',
    help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    refresh: 'M20 4v6h-6M4 20v-6h6M20 10a8 8 0 0 0-14-5M4 14a8 8 0 0 0 14 5',
    save: 'M4 3h13l4 4v14H3V3h1Zm3 0v7h10V3M7 21v-8h10v8M13 5v3',
    link: 'M10 14l4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
    network: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 8v4M12 12l-6 4M12 12l6 4',
    plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v4',
    book: 'M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h14M8 7h8',
    clock: 'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    server: 'M5 4h14v16H5zM8 8h8M8 12h2m4 0h2M8 16h2m4 0h2',
    check: 'M5 12l4 4L19 6',
  };
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ConfiguracoesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = searchParams.get('tab');
  const tab = ['firebird', 'smtp', 'geral', 'integracoes', 'auditoria'].includes(selectedTab ?? '')
    ? selectedTab!
    : 'firebird';
  const setTab = (value: string) => setSearchParams({ tab: value });
  return (
    <div className={styles.page}>
      <div className={styles.pageTitle}>
        <NavIcon name="gear" />
        <div>
          <h1>Configurações</h1>
          <p>Gerencie as configurações do sistema de forma simples e segura.</p>
        </div>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Configurações">
        {[
          {
            key: 'firebird',
            label: 'Banco Firebird',
            icon: <SettingsIcon name="database" />,
          },
          { key: 'smtp', label: 'E-mail', icon: <SettingsIcon name="mail" /> },
          { key: 'geral', label: 'Empresa', icon: <NavIcon name="users" /> },
          { key: 'integracoes', label: 'Integrações', icon: <SettingsIcon name="network" /> },
          { key: 'auditoria', label: 'Auditoria', icon: <NavIcon name="shield" /> },
        ].map((item) => (
          <button
            type="button"
            key={item.key}
            role="tab"
            id={`tab-${item.key}`}
            aria-controls="settings-panel"
            aria-selected={tab === item.key}
            className={tab === item.key ? styles.activeTab : undefined}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      <div
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className={styles.content}
      >
        {tab === 'firebird' && <FirebirdTab />}
        {tab === 'smtp' && <SmtpTab />}
        {tab === 'geral' && <GeralTab />}
        {tab === 'integracoes' && <IntegracoesTab />}
        {tab === 'auditoria' && <AuditoriaTab />}
      </div>
    </div>
  );
}

function FirebirdTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['settings', 'firebird'],
    queryFn: getFirebirdSettings,
  });
  const statusQuery = useQuery({
    queryKey: ['settings', 'firebird', 'status'],
    queryFn: getFirebirdConnectionStatus,
    staleTime: 30_000,
  });
  const [form, setForm] = useSettingsForm<FirebirdSettings>(data);
  const [testResult, setTestResult] = useState<TestFeedback | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [checkedForm, setCheckedForm] = useState<FirebirdSettings | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: saveFirebirdSettings,
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.setQueryData(['settings', 'firebird'], saved);
      void statusQuery.refetch();
      showToast('Configurações do Firebird salvas.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível salvar as configurações do Firebird.'),
  });

  const testMutation = useMutation({
    mutationFn: testFirebirdSettings,
    onSuccess: (result, testedForm) => {
      setTestResult(result);
      setCheckedAt(new Date());
      setCheckedForm({ ...testedForm });
    },
    onError: (error, testedForm) => {
      setTestResult({ ok: false, message: error.message });
      setCheckedAt(new Date());
      setCheckedForm({ ...testedForm });
    },
  });

  if (isError) return <ErrorState error={error} action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />;
  if (isLoading || !form) {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </Card>
    );
  }

  const effectiveStatus = testResult ?? statusQuery.data ?? null;
  const effectiveCheckedAt = checkedAt ?? (statusQuery.data?.checkedAt ? new Date(statusQuery.data.checkedAt) : null);

  return (
    <div className={styles.columns}>
      <section className={styles.connectionCard}>
        <div className={styles.cardHeading}>
          <span className={styles.iconTile}>
            <SettingsIcon name="database" />
          </span>
          <div>
            <h2>Conexão com o Banco de Dados</h2>
            <p>Configure os parâmetros de conexão com o Firebird.</p>
          </div>
          <Button
            variant="secondary"
            className={styles.helpButton}
            onClick={() => setHelpOpen(true)}
          >
            <SettingsIcon name="help" />
            Ajuda
          </Button>
        </div>
        <div className={styles.fields}>
          <div>
            <Input
              label="Host"
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
            />
            <p>Endereço do servidor do banco de dados.</p>
          </div>
          <div>
            <Input
              label="Porta"
              type="number"
              inputMode="numeric"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
            />
            <p>Porta de conexão (padrão: 3050).</p>
          </div>
          <div className={styles.fullRow}>
            <Input
              label="Caminho do banco / alias"
              value={form.database}
              onChange={(e) => setForm({ ...form, database: e.target.value })}
            />
            <p>Caminho completo para o arquivo do banco ou alias de conexão.</p>
          </div>
          <div>
            <Input
              label="Usuário"
              value={form.user}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
            />
            <p>Usuário de acesso ao banco de dados.</p>
          </div>
          <div>
            <PasswordInput
              label="Senha"
              copyable
              placeholder={form.password === '••••••••' ? '••••••••' : ''}
              value={form.password === '••••••••' ? '' : form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onReveal={async () => {
                const result = await getFirebirdPassword();
                setForm((current) => current ? { ...current, password: result.password } : current);
                return result.password;
              }}
            />
            <p>Senha do usuário.</p>
          </div>
          <div className={styles.fullRow}>
            <Select
              label="Charset"
              options={CHARSET_OPTIONS}
              value={form.charset}
              onChange={(e) => setForm({ ...form, charset: e.target.value })}
            />
            <p>Codificação de caracteres utilizada na conexão.</p>
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => testMutation.mutate(form)}
            loading={testMutation.isPending}
          >
            <SettingsIcon name="plug" />
            Testar conexão
          </Button>
          <Button onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>
            <SettingsIcon name="save" />
            Salvar configurações
          </Button>
        </div>
        {saveMutation.isError && <p role="alert">{saveMutation.error.message}</p>}
        {saveMutation.isSuccess && <p role="status">Configurações salvas com sucesso.</p>}
        <div className={styles.notice}>
          <span>
            <SettingsIcon name="check" />
          </span>
          A troca de credenciais é aplicada na hora, sem precisar reiniciar o sistema.
        </div>
      </section>
      <aside className={styles.rightColumn}>
        <section className={styles.statusCard}>
          <h2>
            <span className={styles.statusIcon}>
              <SettingsIcon name="database" />
            </span>
            Status da Conexão
          </h2>
          <div
            className={`${styles.connectionStatus} ${effectiveStatus?.ok ? styles.connected : effectiveStatus ? styles.failed : ''}`}
            role="status"
          >
            <span />
            {testMutation.isPending || statusQuery.isLoading
              ? 'Verificando...'
              : effectiveStatus?.ok
                ? 'Conectado'
                : effectiveStatus
                  ? 'Falha na conexão'
                  : 'Não verificado'}
          </div>
          <p className={styles.statusDescription}>
            {effectiveStatus?.message ?? 'Não foi possível verificar a conexão automaticamente.'}
          </p>
          <dl className={styles.statusList}>
            <div>
              <SettingsIcon name="server" />
              <dt>Servidor</dt>
              <dd>{(checkedForm ?? form).host}</dd>
            </div>
            <div>
              <NavIcon name="shield" />
              <dt>Porta</dt>
              <dd>{(checkedForm ?? form).port}</dd>
            </div>
            <div>
              <SettingsIcon name="database" />
              <dt>Banco de dados</dt>
              <dd>{(checkedForm ?? form).database.split(/[\\/]/).pop()}</dd>
            </div>
            <div>
              <NavIcon name="user" />
              <dt>Usuário</dt>
              <dd>{(checkedForm ?? form).user}</dd>
            </div>
            <div>
              <NavIcon name="shield" />
              <dt>Charset</dt>
              <dd>{(checkedForm ?? form).charset}</dd>
            </div>
          </dl>
          <div className={styles.lastCheck}>
            <SettingsIcon name="clock" />
            <div>
              Última verificação
              <span>{effectiveCheckedAt ? effectiveCheckedAt.toLocaleString('pt-BR') : 'Ainda não realizada'}</span>
            </div>
            <Button
              variant="secondary"
              onClick={() => testMutation.mutate(form)}
              loading={testMutation.isPending}
            >
              <SettingsIcon name="refresh" />
              Testar novamente
            </Button>
          </div>
        </section>
        <section className={styles.supportCard}>
          <span className={styles.iconTile}>
            <SettingsIcon name="help" />
          </span>
          <div>
            <h2>Precisa de ajuda?</h2>
            <p>Consulte nossa base de conhecimento ou entre em contato com o suporte.</p>
            <Button variant="secondary" onClick={() => setHelpOpen(true)}>
              <SettingsIcon name="book" />
              Ver documentação
            </Button>
          </div>
        </section>
      </aside>
      <Modal open={helpOpen} title="Ajuda — conexão Firebird" onClose={() => setHelpOpen(false)}>
        <p>
          Informe o host do servidor, a porta (padrão 3050) e o caminho do arquivo do banco no
          servidor ou seu alias.
        </p>
        <p>
          Preencha o usuário, a senha e o charset fornecidos pelo administrador do banco. Deixe a
          senha em branco para manter a atual.
        </p>
        <p>
          Use “Testar conexão” para verificar os parâmetros e “Salvar configurações” para
          aplicá-los.
        </p>
      </Modal>
    </div>
  );
}

function SmtpTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['settings', 'smtp'],
    queryFn: getSmtpSettings,
  });
  const [form, setForm] = useSettingsForm<SmtpSettings>(data);
  const [destino, setDestino] = useState('');
  const [testResult, setTestResult] = useState<TestFeedback | null>(null);

  const saveMutation = useMutation({
    mutationFn: saveSmtpSettings,
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.setQueryData(['settings', 'smtp'], saved);
      showToast('Configurações de e-mail salvas.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível salvar as configurações de e-mail.'),
  });

  const testMutation = useMutation({
    mutationFn: () => testSmtpSettings(form!, destino),
    onSuccess: setTestResult,
  });

  if (isError) return <ErrorState error={error} action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />;
  if (isLoading || !form) {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </Card>
    );
  }

  return (
    <section className={`${styles.connectionCard} ${styles.singleCard}`}>
      <div className={styles.cardHeading}>
        <span className={styles.iconTile}>
          <SettingsIcon name="mail" />
        </span>
        <div>
          <h2>Configurações de E-mail</h2>
          <p>Servidor SMTP usado para envio de e-mails do sistema.</p>
        </div>
      </div>
      {!form.host || !form.fromEmail ? (
        <div className={styles.badgeRow}>
          <Badge tone="warning">
            Configure o e-mail para habilitar a redefinição de senha no login.
          </Badge>
        </div>
      ) : null}
      <div className={styles.settingsSection}>
        <div className={styles.sectionIntro}><span>1</span><div><h3>Servidor de envio</h3><p>Dados fornecidos pelo seu provedor de e-mail.</p></div></div>
        <div className={styles.fields}>
          <Input label="Servidor SMTP" placeholder="smtp.exemplo.com" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          <Input label="Porta" type="number" inputMode="numeric" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
          <Select label="Tipo de segurança" options={SEGURANCA_OPTIONS} value={form.seguranca} onChange={(e) => setForm({ ...form, seguranca: e.target.value as SmtpSettings['seguranca'] })} />
        </div>
      </div>
      <div className={styles.settingsSection}>
        <div className={styles.sectionIntro}><span>2</span><div><h3>Conta e remetente</h3><p>Credenciais de autenticação e nome exibido nos e-mails.</p></div></div>
        <div className={styles.fields}>
          <Input label="Usuário da conta" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
          <PasswordInput label="Senha ou senha de aplicativo" copyable onReveal={async () => {
            const result = await getSmtpPassword();
            setForm((current) => current ? { ...current, password: result.password } : current);
            return result.password;
          }} placeholder={form.password === '••••••••' ? 'Deixe em branco para manter a atual' : ''} value={form.password === '••••••••' ? '' : form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Input label="E-mail remetente" type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} />
          <Input label="Nome do remetente" value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
        </div>
      </div>
      <div className={styles.testPanel}>
        <div><strong>3. Confirme antes de usar</strong><p>Envie uma mensagem para verificar servidor, credenciais e remetente.</p></div>
        <Input label="E-mail para o teste" type="email" placeholder="voce@empresa.com" value={destino} onChange={(e) => setDestino(e.target.value)} />
        <Button variant="secondary" onClick={() => testMutation.mutate()} loading={testMutation.isPending} disabled={!destino}>Enviar teste</Button>
      </div>
      {testResult && <div className={styles.badgeRow}><Badge tone={testResult.ok ? 'success' : 'danger'}>{testResult.message}</Badge></div>}
      <div className={styles.formFooter}>
        <p>As alterações passam a valer nos próximos e-mails enviados.</p>
        <Button onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}><SettingsIcon name="save" />Salvar configurações de e-mail</Button>
      </div>
    </section>
  );
}

function GeralTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['settings', 'geral'],
    queryFn: getGeralSettings,
  });
  const [form, setForm] = useSettingsForm<GeralSettings>(data);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const saveMutation = useMutation({
    mutationFn: saveGeralSettings,
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.setQueryData(['settings', 'geral'], saved);
      queryClient.setQueryData(['branding'], { nomeEmpresa: saved.nomeEmpresa, logoUrl: saved.logoUrl, corDestaque: saved.corDestaque });
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível salvar as configurações gerais.'),
  });

  function selecionarLogo(file: File | undefined) {
    if (!file || !form) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      showToast('Escolha uma imagem PNG, JPEG ou WebP de até 1 MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveMutation.mutate({ ...form, logoUrl: reader.result }, { onSuccess: () => showToast('Logo atualizada com sucesso.', 'success') });
      }
    };
    reader.readAsDataURL(file);
  }

  function removerLogo() {
    if (!form) return;
    saveMutation.mutate({ ...form, logoUrl: '' }, { onSuccess: () => showToast('Logo removida.', 'success') });
  }

  if (isError) return <ErrorState error={error} action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />;
  if (isLoading || !form) {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </Card>
    );
  }

  return (
    <section className={`${styles.connectionCard} ${styles.singleCard}`}>
      <div className={styles.cardHeading}>
        <span className={styles.iconTile}>
          <NavIcon name="gear" />
        </span>
        <div>
          <h2>Cadastro da empresa</h2>
          <p>Informações que identificam sua empresa no sistema e nos documentos.</p>
        </div>
      </div>
      <div className={styles.fields}>
        <div className={styles.fullRow}>
          <Input
            label="Nome da empresa ou nome fantasia"
            value={form.nomeEmpresa}
            onChange={(e) => setForm({ ...form, nomeEmpresa: e.target.value })}
          />
          <p>Exibido na navegação, relatórios e impressões de ordem de serviço.</p>
        </div>
        <div className={styles.fullRow}>
          <label className={styles.fieldLabel}>Logo da empresa</label>
          <div className={styles.logoUploader}>
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="Logo atual" className={styles.logoPreview} />
            ) : (
              <div className={styles.logoPlaceholder}><NavIcon name="users" /></div>
            )}
            <div className={styles.logoCopy}><strong>{form.logoUrl ? 'Logo atual' : 'Adicione a marca da empresa'}</strong><span>PNG, JPEG ou WebP · máximo de 1 MB</span></div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => selecionarLogo(e.target.files?.[0])}
            />
            <Button size="sm" variant="secondary" loading={saveMutation.isPending} onClick={() => logoInputRef.current?.click()}>
              {form.logoUrl ? 'Trocar logo' : 'Escolher logo'}
            </Button>
            {form.logoUrl && (
              <Button size="sm" variant="secondary" loading={saveMutation.isPending} onClick={removerLogo}>
                Remover
              </Button>
            )}
          </div>
          <p>A logo será usada na barra lateral e no cabeçalho de relatórios e ordens de serviço.</p>
        </div>
        <div className={styles.fullRow}>
          <Input
            label="Fuso horário"
            value={form.fusoHorario}
            onChange={(e) => setForm({ ...form, fusoHorario: e.target.value })}
          />
          <p>Usado nas datas de auditoria, consultas e registros do sistema.</p>
        </div>
      </div>

      <div className={styles.singleAction}>
        <Button
          onClick={() => saveMutation.mutate(form, { onSuccess: () => showToast('Configurações gerais salvas.', 'success') })}
          loading={saveMutation.isPending}
        >
          <SettingsIcon name="save" />
          Salvar cadastro da empresa
        </Button>
      </div>
    </section>
  );
}

function IntegracoesTab() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['settings', 'integracoes'],
    queryFn: getIntegracoesSettings,
  });
  const [form, setForm] = useSettingsForm<IntegracoesSettings>(data);

  const saveMutation = useMutation({
    mutationFn: saveIntegracoesSettings,
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.setQueryData(['settings', 'integracoes'], saved);
      showToast('Integrações salvas.', 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível salvar as integrações.'),
  });

  if (isError) return <ErrorState error={error} action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />;
  if (isLoading || !form) {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </Card>
    );
  }

  return (
    <div className={styles.integrationsList}>
      <section className={`${styles.connectionCard} ${styles.singleCard}`}>
        <div className={styles.cardHeadingSimple}>
          <span className={styles.integrationIcon}><SettingsIcon name="database" /></span>
          <div><h2>Consulta de veículos pela placa</h2><p>Preenchimento automático no cadastro de veículos e na abertura de OS.</p></div>
          <Badge tone={form.dadosApiToken ? 'success' : 'neutral'}>{form.dadosApiToken ? 'Configurada' : 'Não configurada'}</Badge>
          <Tooltip content="A chave fica criptografada no servidor e nunca é enviada novamente ao navegador. Somente administradores podem alterá-la.">
            <button type="button" className={styles.helpIcon} aria-label="Sobre a chave da DadosAPI">ⓘ</button>
          </Tooltip>
        </div>
        <div className={styles.fields}>
          <div className={styles.fullRow}>
            <PasswordInput
              label="Chave da API DadosAPI"
              copyable
              value={form.dadosApiToken === '••••••••' ? '' : form.dadosApiToken}
              onChange={(e) => setForm({ ...form, dadosApiToken: e.target.value })}
              placeholder={form.dadosApiToken ? undefined : 'Nenhuma chave configurada'}
              onReveal={async () => {
                const result = await getIntegrationSecret('dadosApiToken');
                setForm((current) => current ? { ...current, dadosApiToken: result.value } : current);
                return result.value;
              }}
            />
            <p>A DadosAPI libera a chave pela área restrita após o cadastro. Atualmente, o botão de cadastro do site direciona para o atendimento via WhatsApp.</p>
          </div>
        </div>
        <div className={styles.singleAction}>
          <Button size="sm" onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>
            <SettingsIcon name="save" />
            Salvar chave da DadosAPI
          </Button>
        </div>
      </section>
      <section className={`${styles.connectionCard} ${styles.singleCard}`}>
        <div className={styles.cardHeadingSimple}>
          <span className={styles.integrationIcon}><SettingsIcon name="network" /></span>
          <div><h2>Inscrição Estadual por CNPJ</h2><p>Complementa automaticamente o cadastro de clientes.</p></div>
          <Badge tone={form.sintegraApiKey ? 'success' : 'neutral'}>{form.sintegraApiKey ? 'Configurada' : 'Não configurada'}</Badge>
          <Tooltip content="Preenche a Inscrição Estadual automaticamente junto da consulta de CNPJ no cadastro de cliente (via SINTEGRA Brasil). Sem chave configurada, o campo continua editável manualmente.">
            <button type="button" className={styles.helpIcon} aria-label="Sobre a chave da SINTEGRA Brasil">ⓘ</button>
          </Tooltip>
        </div>
        <div className={styles.fields}>
          <div className={styles.fullRow}>
            <PasswordInput
              label="Chave da API SINTEGRA Brasil"
              copyable
              value={form.sintegraApiKey === '••••••••' ? '' : form.sintegraApiKey}
              onChange={(e) => setForm({ ...form, sintegraApiKey: e.target.value })}
              placeholder={form.sintegraApiKey ? undefined : 'Nenhuma chave configurada'}
              onReveal={async () => {
                const result = await getIntegrationSecret('sintegraApiKey');
                setForm((current) => current ? { ...current, sintegraApiKey: result.value } : current);
                return result.value;
              }}
            />
            <p>
              Gere uma chave grátis em{' '}
              <a href="https://www.sintegrabrasil.com.br/api" target="_blank" rel="noreferrer">sintegrabrasil.com.br/api</a>
              {' '}(cadastro só com e-mail).
            </p>
          </div>
        </div>
        <div className={styles.singleAction}>
          <Button size="sm" onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>
            <SettingsIcon name="save" />
            Salvar chave
          </Button>
        </div>
      </section>
    </div>
  );
}
