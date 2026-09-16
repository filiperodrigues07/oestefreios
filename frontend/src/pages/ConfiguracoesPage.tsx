import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  getFirebirdSettings,
  getGeralSettings,
  getSmtpSettings,
  saveFirebirdSettings,
  saveGeralSettings,
  saveSmtpSettings,
  testFirebirdSettings,
  testSmtpSettings,
  type FirebirdSettings,
  type GeralSettings,
  type SmtpSettings,
} from '../api/settings.api.js';
import { Badge, Button, Card, Input, PageHeader, PasswordInput, Select, Tabs } from '../components/ui/index.js';
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

export function ConfiguracoesPage() {
  const [tab, setTab] = useState('firebird');

  return (
    <div className={styles.page}>
      <PageHeader
        title="Configurações"
        description="Gerencie os parâmetros de integração e as preferências da oficina."
      />

      <div className={styles.content}>
      <Tabs
        items={[
          { key: 'firebird', label: 'Banco de Dados (Firebird)' },
          { key: 'smtp', label: 'E-mail (SMTP)' },
          { key: 'geral', label: 'Geral' },
        ]}
        active={tab}
        onChange={setTab}
        variant="segmented"
        fullWidth
      >
        {tab === 'firebird' && <FirebirdTab />}
        {tab === 'smtp' && <SmtpTab />}
        {tab === 'geral' && <GeralTab />}
      </Tabs>
      </div>
    </div>
  );
}

function FirebirdTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'firebird'], queryFn: getFirebirdSettings });
  const [form, setForm] = useState<FirebirdSettings | null>(null);
  const [testResult, setTestResult] = useState<TestFeedback | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: saveFirebirdSettings,
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.setQueryData(['settings', 'firebird'], saved);
    },
  });

  const testMutation = useMutation({
    mutationFn: testFirebirdSettings,
    onSuccess: setTestResult,
  });

  if (isLoading || !form) return <Card>Carregando...</Card>;

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Input label="Host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
      <Input
        label="Porta"
        type="number"
        value={form.port}
        onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
      />
      <Input
        label="Caminho do banco / alias"
        value={form.database}
        onChange={(e) => setForm({ ...form, database: e.target.value })}
      />
      <Input label="Usuário" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
      <PasswordInput
        label="Senha"
        placeholder={form.password === '••••••••' ? 'Deixe em branco para manter a atual' : ''}
        value={form.password === '••••••••' ? '' : form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <Select
        label="Charset"
        options={CHARSET_OPTIONS}
        value={form.charset}
        onChange={(e) => setForm({ ...form, charset: e.target.value })}
      />

      {testResult && (
        <Badge tone={testResult.ok ? 'success' : 'danger'}>{testResult.message}</Badge>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button variant="secondary" onClick={() => testMutation.mutate(form)} loading={testMutation.isPending}>
          Testar conexão
        </Button>
        <Button onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>
          Salvar
        </Button>
      </div>
      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
        A troca de credenciais é aplicada na hora, sem precisar reiniciar o sistema.
      </p>
    </Card>
  );
}

function SmtpTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'smtp'], queryFn: getSmtpSettings });
  const [form, setForm] = useState<SmtpSettings | null>(null);
  const [destino, setDestino] = useState('');
  const [testResult, setTestResult] = useState<TestFeedback | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: saveSmtpSettings,
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.setQueryData(['settings', 'smtp'], saved);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testSmtpSettings(form!, destino),
    onSuccess: setTestResult,
  });

  if (isLoading || !form) return <Card>Carregando...</Card>;

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {!form.host || !form.fromEmail ? (
        <Badge tone="warning">Configure o e-mail para habilitar a redefinição de senha no login.</Badge>
      ) : null}

      <Input label="Host SMTP" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
      <Input
        label="Porta"
        type="number"
        value={form.port}
        onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
      />
      <Select
        label="Segurança"
        options={SEGURANCA_OPTIONS}
        value={form.seguranca}
        onChange={(e) => setForm({ ...form, seguranca: e.target.value as SmtpSettings['seguranca'] })}
      />
      <Input label="Usuário" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
      <PasswordInput
        label="Senha"
        placeholder={form.password === '••••••••' ? 'Deixe em branco para manter a atual' : ''}
        value={form.password === '••••••••' ? '' : form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <Input
        label="E-mail remetente (De)"
        type="email"
        value={form.fromEmail}
        onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
      />
      <Input
        label="Nome do remetente"
        value={form.fromName}
        onChange={(e) => setForm({ ...form, fromName: e.target.value })}
      />

      <Input
        label="Enviar e-mail de teste para"
        type="email"
        placeholder="seu@email.com"
        value={destino}
        onChange={(e) => setDestino(e.target.value)}
      />

      {testResult && <Badge tone={testResult.ok ? 'success' : 'danger'}>{testResult.message}</Badge>}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button
          variant="secondary"
          onClick={() => testMutation.mutate()}
          loading={testMutation.isPending}
          disabled={!destino}
        >
          Enviar e-mail de teste
        </Button>
        <Button onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>
          Salvar
        </Button>
      </div>
    </Card>
  );
}

function GeralTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'geral'], queryFn: getGeralSettings });
  const [form, setForm] = useState<GeralSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: saveGeralSettings,
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.setQueryData(['settings', 'geral'], saved);
    },
  });

  if (isLoading || !form) return <Card>Carregando...</Card>;

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Input
        label="Nome da empresa"
        value={form.nomeEmpresa}
        onChange={(e) => setForm({ ...form, nomeEmpresa: e.target.value })}
      />
      <Input
        label="URL do logo"
        placeholder="https://..."
        value={form.logoUrl}
        onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
      />
      <div>
        <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
          Cor de destaque
        </label>
        <input
          type="color"
          value={form.corDestaque || '#0369a1'}
          onChange={(e) => setForm({ ...form, corDestaque: e.target.value })}
          style={{ width: 60, height: 40, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
        />
      </div>
      <Input
        label="Fuso horário"
        value={form.fusoHorario}
        onChange={(e) => setForm({ ...form, fusoHorario: e.target.value })}
      />

      <div>
        <Button onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>
          Salvar
        </Button>
      </div>
    </Card>
  );
}
