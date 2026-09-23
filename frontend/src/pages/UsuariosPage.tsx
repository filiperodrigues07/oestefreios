import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { createUser, deleteUser, exportUsersExcel, listCherpUsers, listRoles, listUsers, reenviarConvite, updateUser } from '../api/users.api.js';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  PasswordInput,
  ResponsiveFilters,
  SearchInput,
  Select,
  Skeleton,
  Table,
  useToast,
  type BadgeTone,
  type TableColumn,
} from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from '../types/auth.types.js';
import type { RoleOptionDTO, UserSummaryDTO } from '../types/user.types.js';
import { isSecurePassword, PASSWORD_RULES } from '../utils/passwordPolicy.js';
import styles from './UsuariosPage.module.css';

const ROLE_TONES: Record<string, BadgeTone> = {
  Administrador: 'danger',
  Gerente: 'primary',
  Supervisor: 'info',
  Atendente: 'success',
  Mecânico: 'warning',
};

function roleTone(name: string): BadgeTone {
  return ROLE_TONES[name] ?? 'neutral';
}

function setsEqual(a: Permission[], b: Permission[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((p) => setB.has(p));
}

/**
 * Gestão de usuários e permissões (item 5 da rodada de melhorias). Permissão efetiva agora
 * vive por usuário (Fase G) — o perfil só serve de "preset" pra pré-marcar a matriz; escolher
 * um perfil novo reaplica o preset dele, e desmarcar/marcar itens individualmente gera um
 * usuário "customizado" (avisado tanto na lista quanto no formulário).
 */
export function UsuariosPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<UserSummaryDTO | null>(null);
  const [excluindo, setExcluindo] = useState<UserSummaryDTO | null>(null);
  const [busca, setBusca] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');
  const [vinculo, setVinculo] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [exportando, setExportando] = useState(false);

  const podeCriar = hasPermission('USER_CREATE');
  const podeEditar = hasPermission('USER_EDIT');
  const podeExcluir = hasPermission('USER_DELETE');

  const {
    data: usuarios,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ['usuarios'], queryFn: listUsers });

  const { data: roles } = useQuery({ queryKey: ['usuarios-roles'], queryFn: listRoles });

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
    return (usuarios ?? []).filter((u) => {
      if (termo && ![u.name, u.email, u.roleName, String(u.cherpUsuarioChave ?? '')].some((value) => value.toLocaleLowerCase('pt-BR').includes(termo))) return false;
      if (roleId && u.roleId !== roleId) return false;
      if (status === 'ativo' && !u.isActive) return false;
      if (status === 'inativo' && u.isActive) return false;
      if (vinculo === 'vinculado' && !u.cherpUsuarioChave) return false;
      if (vinculo === 'nao-vinculado' && u.cherpUsuarioChave) return false;
      return true;
    }).sort((a, b) => {
      const value = (u: UserSummaryDTO) => {
        if (sortBy === 'isActive') return u.isActive ? 'Ativo' : 'Inativo';
        if (sortBy === 'cherpUsuarioChave') return u.cherpUsuarioChave ?? -1;
        if (sortBy === 'email' || sortBy === 'roleName') return u[sortBy];
        return u.name;
      };
      return (sortOrder === 'asc' ? 1 : -1) * collator.compare(String(value(a)), String(value(b)));
    });
  }, [usuarios, busca, roleId, status, vinculo, sortBy, sortOrder]);

  function handleSortChange(key: string) {
    setSortOrder((order) => key === sortBy ? (order === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortBy(key);
  }

  async function handleExport() {
    setExportando(true);
    try {
      await exportUsersExcel({ busca: busca.trim(), roleId, status, vinculo, sortBy, sortOrder });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível exportar os usuários.', 'danger');
    } finally {
      setExportando(false);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      showToast('Usuário excluído com sucesso.', 'success');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setExcluindo(null);
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir usuário.', 'danger');
      setExcluindo(null);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (id: string) => reenviarConvite(id),
    onSuccess: () => showToast('Convite reenviado com sucesso.', 'success'),
    onError: (err) => showToast(err instanceof Error ? err.message : 'Erro ao reenviar convite.', 'danger'),
  });

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(usuario: UserSummaryDTO) {
    setEditando(usuario);
    setModalAberto(true);
  }

  const columns: TableColumn<UserSummaryDTO>[] = [
    { key: 'name', header: 'Nome', render: (u) => u.name, sortable: true },
    { key: 'email', header: 'E-mail', render: (u) => u.email, mono: true, sortable: true },
    {
      key: 'roleName',
      header: 'Perfil',
      sortable: true,
      render: (u) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Badge tone={roleTone(u.roleName)}>{u.roleName}</Badge>
          {u.isCustom && <Badge tone="warning">Customizado</Badge>}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (u) => <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Ativo' : 'Inativo'}</Badge>,
    },
    {
      key: 'cherpUsuarioChave',
      header: 'CHERP',
      sortable: true,
      render: (u) => u.cherpUsuarioChave ? `#${u.cherpUsuarioChave}` : 'Não vinculado',
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      width: '160px',
      render: (u) => (
        <div className={styles.rowActions}>
          {podeEditar && (
            <Button
              size="sm"
              variant="secondary"
              className={styles.iconButton}
              onClick={() => inviteMutation.mutate(u.id)}
              loading={inviteMutation.isPending && inviteMutation.variables === u.id}
              aria-label={`Reenviar convite para ${u.name}`}
              title="Reenviar convite"
            >
              <ActionIcon name="mail" />
            </Button>
          )}
          {podeEditar && (
            <Button size="sm" variant="secondary" className={styles.iconButton} onClick={() => abrirEdicao(u)} aria-label={`Editar ${u.name}`} title="Editar usuário">
              <ActionIcon name="edit" />
            </Button>
          )}
          {podeExcluir && (
            <Button size="sm" variant="destructive" className={styles.iconButton} onClick={() => setExcluindo(u)} aria-label={`Excluir ${u.name}`} title="Excluir usuário">
              <ActionIcon name="delete" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Usuários"
        description="Gerencie os acessos e permissões da equipe."
        actions={<>
          {podeCriar && <Button onClick={abrirNovo}><ActionIcon name="add" />Novo usuário</Button>}
          <Button variant="secondary" size="sm" onClick={handleExport} loading={exportando} disabled={!usuarios?.length}><ActionIcon name="excel" />Exportar Excel</Button>
        </>}
      />

      {!isLoading && !isError && <p className={styles.total}><strong>{usuariosFiltrados.length.toLocaleString('pt-BR')}</strong> {usuariosFiltrados.length === 1 ? 'registro' : 'registros'}</p>}

      <div className={styles.filters} aria-label="Filtros de usuários">
        <SearchInput placeholder="Buscar por nome, e-mail, perfil ou CHERP" value={busca} onChange={(event) => setBusca(event.target.value)} aria-label="Buscar usuários" />
        <ResponsiveFilters activeCount={Number(Boolean(roleId)) + Number(Boolean(status)) + Number(Boolean(vinculo))} onClear={() => { setRoleId(''); setStatus(''); setVinculo(''); }}>
          <Select label="Perfil" value={roleId} onChange={(event) => setRoleId(event.target.value)} options={[{ value: '', label: 'Todos' }, ...(roles ?? []).map((role) => ({ value: role.id, label: role.name }))]} />
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: '', label: 'Todos' }, { value: 'ativo', label: 'Ativos' }, { value: 'inativo', label: 'Inativos' }]} />
          <Select label="Vínculo CHERP" value={vinculo} onChange={(event) => setVinculo(event.target.value)} options={[{ value: '', label: 'Todos' }, { value: 'vinculado', label: 'Vinculados' }, { value: 'nao-vinculado', label: 'Não vinculados' }]} />
        </ResponsiveFilters>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      )}

      {isError && <ErrorState error={error} action={<Button onClick={() => refetch()}>Tentar de novo</Button>} />}

      {!isLoading && !isError && usuarios && usuarios.length === 0 && <EmptyState title="Nenhum usuário cadastrado ainda" />}

      {!isLoading && !isError && usuarios && usuarios.length > 0 && usuariosFiltrados.length === 0 && <EmptyState title="Nenhum usuário encontrado" description="Ajuste os filtros para encontrar usuários." />}

      {!isLoading && !isError && usuariosFiltrados.length > 0 && (
        <Table columns={columns} data={usuariosFiltrados} rowKey={(u) => u.id} sortBy={sortBy} sortOrder={sortOrder} onSortChange={handleSortChange} columnPrefsKey="usuarios" />
      )}

      <UsuarioFormModal
        open={modalAberto}
        usuario={editando}
        roles={roles ?? []}
        onClose={() => setModalAberto(false)}
        onSaved={() => {
          setModalAberto(false);
          refetch();
        }}
      />

      <ConfirmDialog
        open={excluindo !== null}
        title="Excluir usuário"
        description={`Tem certeza que deseja excluir "${excluindo?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => excluindo && deleteMutation.mutate(excluindo.id)}
        onCancel={() => setExcluindo(null)}
      />
    </div>
  );
}

interface FormState {
  name: string;
  email: string;
  roleId: string;
  isActive: boolean;
  permissions: Permission[];
  cherpUsuarioChave: string;
  definirSenha: boolean;
  password: string;
  passwordConfirmation: string;
}

function formVazio(roles: RoleOptionDTO[]): FormState {
  const primeiro = roles[0];
  return { name: '', email: '', roleId: primeiro?.id ?? '', isActive: true, permissions: primeiro?.permissions ?? [], cherpUsuarioChave: '', definirSenha: false, password: '', passwordConfirmation: '' };
}

function formDeUsuario(usuario: UserSummaryDTO): FormState {
  return {
    name: usuario.name,
    email: usuario.email,
    roleId: usuario.roleId,
    isActive: usuario.isActive,
    permissions: usuario.permissions,
    cherpUsuarioChave: usuario.cherpUsuarioChave ? String(usuario.cherpUsuarioChave) : '',
    definirSenha: false,
    password: '',
    passwordConfirmation: '',
  };
}

interface UsuarioFormModalProps {
  open: boolean;
  usuario: UserSummaryDTO | null;
  roles: RoleOptionDTO[];
  onClose: () => void;
  onSaved: () => void;
}

function UsuarioFormModal({ open, usuario, roles, onClose, onSaved }: UsuarioFormModalProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(usuario ? formDeUsuario(usuario) : formVazio(roles));
  const { data: cherpUsers = [] } = useQuery({ queryKey: ['usuarios-cherp'], queryFn: listCherpUsers, enabled: open });

  // Ressincroniza o form quando o usuário sendo editado muda (ou ao abrir "novo"), igual ClientesPage.
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  if ((usuario?.id ?? null) !== ultimoId) {
    setUltimoId(usuario?.id ?? null);
    setForm(usuario ? formDeUsuario(usuario) : formVazio(roles));
  }

  const roleSelecionado = roles.find((r) => r.id === form.roleId);
  const preset = roleSelecionado?.permissions ?? [];
  const isCustom = form.roleId !== '' && !setsEqual(form.permissions, preset);
  const isAdminRole = roleSelecionado?.name === 'Administrador';

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        email: form.email,
        roleId: form.roleId,
        isActive: form.isActive,
        permissions: form.permissions,
        cherpUsuarioChave: form.cherpUsuarioChave ? Number(form.cherpUsuarioChave) : null,
        ...(!usuario && form.definirSenha ? { password: form.password } : {}),
      };
      return usuario ? updateUser(usuario.id, payload) : createUser(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      showToast(
        usuario ? 'Usuário atualizado com sucesso.' : form.definirSenha ? 'Usuário criado com senha inicial.' : 'Usuário criado com sucesso. Um e-mail de convite foi enviado.',
        'success',
      );
      onSaved();
    },
  });

  function handleRoleChange(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    setForm((f) => ({
      ...f,
      roleId,
      permissions: role?.name === 'Administrador' ? role.permissions : (role?.permissions ?? []).filter((p) => p !== 'SYSTEM_SETTINGS'),
    }));
  }

  function togglePermission(permission: Permission) {
    if (permission === 'SYSTEM_SETTINGS' && !isAdminRole) return;
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(permission)
        ? f.permissions.filter((p) => p !== permission)
        : [...f.permissions, permission],
    }));
  }

  function toggleGroup(groupPermissions: Permission[], marcar: boolean) {
    const permissoesAplicaveis = isAdminRole ? groupPermissions : groupPermissions.filter((p) => p !== 'SYSTEM_SETTINGS');
    setForm((f) => ({
      ...f,
      permissions: marcar
        ? Array.from(new Set([...f.permissions, ...permissoesAplicaveis]))
        : f.permissions.filter((p) => !permissoesAplicaveis.includes(p)),
    }));
  }

  return (
    <Modal
      open={open}
      title={usuario ? 'Editar usuário' : 'Novo usuário'}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!form.name.trim() || !form.email.trim() || !form.roleId || (!usuario && form.definirSenha && (!isSecurePassword(form.password) || form.password !== form.passwordConfirmation))}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4)' }}>
        <Card>
          <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>Dados</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Input label="Nome" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input
              label="E-mail"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Select
              label="Usuário vinculado no CHERP"
              placeholder="Nenhum vínculo"
              options={cherpUsers.map((item) => ({ value: String(item.chave), label: `${item.nome}${item.login && item.login !== item.nome ? ` (${item.login})` : ''}` }))}
              value={form.cherpUsuarioChave}
              onChange={(e) => setForm({ ...form, cherpUsuarioChave: e.target.value })}
            />
            <Select
              label="Perfil"
              placeholder="Selecione um perfil"
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              value={form.roleId}
              onChange={(e) => handleRoleChange(e.target.value)}
            />
            <Checkbox
              label="Usuário ativo"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
          </div>
        </Card>

        {!usuario && (
          <Card>
            <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>Acesso ao sistema</h3>
            <Checkbox
              label="Definir senha inicial agora (em vez de enviar convite por e-mail)"
              checked={form.definirSenha}
              onChange={(e) => setForm({ ...form, definirSenha: e.target.checked, password: '', passwordConfirmation: '' })}
            />
            {form.definirSenha ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <PasswordInput label="Senha inicial" value={form.password} maxLength={128} autoComplete="new-password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <PasswordInput label="Confirmar senha" value={form.passwordConfirmation} maxLength={128} autoComplete="new-password" onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })} />
                <div aria-live="polite" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '4px', fontSize: 'var(--font-size-xs)' }}>
                  {PASSWORD_RULES.map((rule) => <span key={rule.label} style={{ color: rule.test(form.password) ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{rule.test(form.password) ? '✓' : '○'} {rule.label}</span>)}
                  {(() => {
                    const primeiroNome = form.name.trim().split(' ')[0]?.toLowerCase() ?? '';
                    const semNome = form.password.length > 0 && primeiroNome.length > 0 && !form.password.toLowerCase().includes(primeiroNome);
                    return (
                      <span style={{ color: semNome ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                        {semNome ? '✓' : '○'} Não contém o nome do usuário
                      </span>
                    );
                  })()}
                  <span style={{ color: form.password && form.password === form.passwordConfirmation ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{form.password && form.password === form.passwordConfirmation ? '✓' : '○'} Senhas iguais</span>
                </div>
              </div>
            ) : (
              <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Um e-mail de convite será enviado para que o usuário defina a própria senha.
              </p>
            )}
          </Card>
        )}

        <Card>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>Permissões</h3>
            <span role="status" aria-live="polite">
              {isCustom && <Badge tone="warning">Diferente do padrão do perfil</Badge>}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {PERMISSION_GROUPS.map((group) => (
              <PermissionGroupSection
                key={group.label}
                group={group}
                selected={form.permissions}
                preset={preset}
                isAdminRole={isAdminRole}
                onTogglePermission={togglePermission}
                onToggleGroup={toggleGroup}
              />
            ))}
          </div>
        </Card>

        {saveMutation.isError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {saveMutation.error instanceof Error ? saveMutation.error.message : 'Erro ao salvar usuário.'}
          </p>
        )}
      </div>
    </Modal>
  );
}

interface PermissionGroupSectionProps {
  group: { label: string; permissions: Permission[] };
  selected: Permission[];
  preset: Permission[];
  isAdminRole: boolean;
  onTogglePermission: (permission: Permission) => void;
  onToggleGroup: (permissions: Permission[], marcar: boolean) => void;
}

function PermissionGroupSection({ group, selected, preset, isAdminRole, onTogglePermission, onToggleGroup }: PermissionGroupSectionProps) {
  const marcados = group.permissions.filter((p) => selected.includes(p));
  const todasMarcadas = marcados.length === group.permissions.length;
  const algumasMarcadas = marcados.length > 0 && !todasMarcadas;
  const diferenteDoPreset = group.permissions.some((p) => selected.includes(p) !== preset.includes(p));

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}
      >
        <Checkbox
          label={group.label}
          checked={todasMarcadas}
          indeterminate={algumasMarcadas}
          onChange={() => onToggleGroup(group.permissions, !todasMarcadas)}
        />
        {diferenteDoPreset && <Badge tone="warning">Customizado</Badge>}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-1) var(--space-3)',
          paddingLeft: 'var(--space-6)',
        }}
      >
        {group.permissions.map((p) => {
          const bloqueadoParaNaoAdmin = p === 'SYSTEM_SETTINGS' && !isAdminRole;
          return (
            <Checkbox
              key={p}
              label={bloqueadoParaNaoAdmin ? `${PERMISSION_LABELS[p]} (somente Administrador)` : PERMISSION_LABELS[p]}
              checked={selected.includes(p)}
              disabled={bloqueadoParaNaoAdmin}
              onChange={() => onTogglePermission(p)}
            />
          );
        })}
      </div>
    </div>
  );
}
