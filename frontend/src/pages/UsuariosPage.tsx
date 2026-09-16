import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createUser, deleteUser, listRoles, listUsers, reenviarConvite, updateUser } from '../api/users.api.js';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
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
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [editando, setEditando] = useState<UserSummaryDTO | null>(null);
  const [excluindo, setExcluindo] = useState<UserSummaryDTO | null>(null);

  const podeCriar = hasPermission('USER_CREATE');
  const podeEditar = hasPermission('USER_EDIT');
  const podeExcluir = hasPermission('USER_DELETE');

  const {
    data: usuarios,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['usuarios'], queryFn: listUsers });

  const { data: roles } = useQuery({ queryKey: ['usuarios-roles'], queryFn: listRoles });

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
    setDrawerAberto(true);
  }

  function abrirEdicao(usuario: UserSummaryDTO) {
    setEditando(usuario);
    setDrawerAberto(true);
  }

  const columns: TableColumn<UserSummaryDTO>[] = [
    { key: 'name', header: 'Nome', render: (u) => u.name },
    { key: 'email', header: 'E-mail', render: (u) => u.email, mono: true },
    {
      key: 'roleName',
      header: 'Perfil',
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
      render: (u) => <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Ativo' : 'Inativo'}</Badge>,
    },
    {
      key: 'acoes',
      header: '',
      align: 'right',
      render: (u) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          {podeEditar && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => inviteMutation.mutate(u.id)}
              loading={inviteMutation.isPending && inviteMutation.variables === u.id}
            >
              Reenviar convite
            </Button>
          )}
          {podeEditar && (
            <Button size="sm" variant="secondary" onClick={() => abrirEdicao(u)}>
              Editar
            </Button>
          )}
          {podeExcluir && (
            <Button size="sm" variant="destructive" onClick={() => setExcluindo(u)}>
              Excluir
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
        actions={podeCriar ? <Button onClick={abrirNovo}>+ Novo usuário</Button> : undefined}
      />

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      )}

      {isError && <ErrorState action={<Button onClick={() => refetch()}>Tentar de novo</Button>} />}

      {!isLoading && !isError && usuarios && usuarios.length === 0 && <EmptyState title="Nenhum usuário cadastrado ainda" />}

      {!isLoading && !isError && usuarios && usuarios.length > 0 && (
        <Table columns={columns} data={usuarios} rowKey={(u) => u.id} />
      )}

      <UsuarioFormDrawer
        open={drawerAberto}
        usuario={editando}
        roles={roles ?? []}
        onClose={() => setDrawerAberto(false)}
        onSaved={() => {
          setDrawerAberto(false);
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
}

function formVazio(roles: RoleOptionDTO[]): FormState {
  const primeiro = roles[0];
  return { name: '', email: '', roleId: primeiro?.id ?? '', isActive: true, permissions: primeiro?.permissions ?? [] };
}

function formDeUsuario(usuario: UserSummaryDTO): FormState {
  return {
    name: usuario.name,
    email: usuario.email,
    roleId: usuario.roleId,
    isActive: usuario.isActive,
    permissions: usuario.permissions,
  };
}

interface UsuarioFormDrawerProps {
  open: boolean;
  usuario: UserSummaryDTO | null;
  roles: RoleOptionDTO[];
  onClose: () => void;
  onSaved: () => void;
}

function UsuarioFormDrawer({ open, usuario, roles, onClose, onSaved }: UsuarioFormDrawerProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(usuario ? formDeUsuario(usuario) : formVazio(roles));

  // Ressincroniza o form quando o usuário sendo editado muda (ou ao abrir "novo"), igual ClientesPage.
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  if ((usuario?.id ?? null) !== ultimoId) {
    setUltimoId(usuario?.id ?? null);
    setForm(usuario ? formDeUsuario(usuario) : formVazio(roles));
  }

  const roleSelecionado = roles.find((r) => r.id === form.roleId);
  const preset = roleSelecionado?.permissions ?? [];
  const isCustom = form.roleId !== '' && !setsEqual(form.permissions, preset);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        email: form.email,
        roleId: form.roleId,
        isActive: form.isActive,
        permissions: form.permissions,
      };
      return usuario ? updateUser(usuario.id, payload) : createUser(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      showToast(
        usuario ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso. Um e-mail de convite foi enviado.',
        'success',
      );
      onSaved();
    },
  });

  function handleRoleChange(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    setForm((f) => ({ ...f, roleId, permissions: role?.permissions ?? [] }));
  }

  function togglePermission(permission: Permission) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(permission)
        ? f.permissions.filter((p) => p !== permission)
        : [...f.permissions, permission],
    }));
  }

  function toggleGroup(groupPermissions: Permission[], marcar: boolean) {
    setForm((f) => ({
      ...f,
      permissions: marcar
        ? Array.from(new Set([...f.permissions, ...groupPermissions]))
        : f.permissions.filter((p) => !groupPermissions.includes(p)),
    }));
  }

  return (
    <Drawer open={open} title={usuario ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4)' }}>
        <Input label="Nome" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input
          label="E-mail"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
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

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-2)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>Permissões</h3>
            {isCustom && <Badge tone="warning">Diferente do padrão do perfil</Badge>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {PERMISSION_GROUPS.map((group) => (
              <PermissionGroupSection
                key={group.label}
                group={group}
                selected={form.permissions}
                preset={preset}
                onTogglePermission={togglePermission}
                onToggleGroup={toggleGroup}
              />
            ))}
          </div>
        </div>

        {saveMutation.isError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {saveMutation.error instanceof Error ? saveMutation.error.message : 'Erro ao salvar usuário.'}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!form.name.trim() || !form.email.trim() || !form.roleId}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

interface PermissionGroupSectionProps {
  group: { label: string; permissions: Permission[] };
  selected: Permission[];
  preset: Permission[];
  onTogglePermission: (permission: Permission) => void;
  onToggleGroup: (permissions: Permission[], marcar: boolean) => void;
}

function PermissionGroupSection({ group, selected, preset, onTogglePermission, onToggleGroup }: PermissionGroupSectionProps) {
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
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-1) var(--space-3)',
          paddingLeft: 'var(--space-6)',
        }}
      >
        {group.permissions.map((p) => (
          <Checkbox key={p} label={PERMISSION_LABELS[p]} checked={selected.includes(p)} onChange={() => onTogglePermission(p)} />
        ))}
      </div>
    </div>
  );
}
