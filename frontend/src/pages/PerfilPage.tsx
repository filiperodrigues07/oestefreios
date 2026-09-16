import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { logout, updateMyProfile, updateMyProfilePhoto } from '../api/auth.api.js';
import { Avatar, Badge, Button, Card, Input, LinkButton, PageHeader, useToast } from '../components/ui/index.js';
import { hasPermission, useAuthStore } from '../store/authStore.js';
import { useThemeStore } from '../store/themeStore.js';
import styles from './PerfilPage.module.css';

export function PerfilPage() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [editando, setEditando] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const photoMutation = useMutation({
    mutationFn: updateMyProfilePhoto,
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      showToast('Foto de perfil atualizada com sucesso.', 'success');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => updateMyProfile(name.trim(), email.trim()),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      setEditando(false);
      showToast('Perfil atualizado com sucesso.', 'success');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSession();
      navigate('/login', { replace: true });
    },
  });

  function iniciarEdicao() {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setEditando(true);
  }

  function selecionarFoto(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      showToast('Escolha uma imagem PNG, JPEG ou WebP de até 1 MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') photoMutation.mutate(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Perfil"
        description="Consulte seus acessos e mantenha seus dados atualizados."
        actions={<LinkButton to="/" variant="secondary">Voltar</LinkButton>}
      />

      <Card className={styles.card}>
        <div className={styles.identity}>
          <div className={styles.photoControl}>
            <Avatar name={user?.name ?? '?'} photoUrl={user?.photoUrl ?? undefined} size={64} />
            <input
              ref={photoInputRef}
              className={styles.photoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => selecionarFoto(event.target.files?.[0])}
            />
            <Button size="sm" variant="secondary" loading={photoMutation.isPending} onClick={() => photoInputRef.current?.click()}>
              Alterar foto
            </Button>
          </div>
          {!editando ? (
            <div>
              <div style={{ fontWeight: 600 }}>{user?.name}</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{user?.email}</div>
            </div>
          ) : (
            <div className={styles.editFields}>
              <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}
        </div>

        {saveMutation.isError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {saveMutation.error instanceof Error ? saveMutation.error.message : 'Erro ao salvar perfil.'}
          </p>
        )}

        {photoMutation.isError && (
          <p role="alert" className={styles.error}>
            {photoMutation.error instanceof Error ? photoMutation.error.message : 'Erro ao enviar a foto.'}
          </p>
        )}

        {editando ? (
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!name.trim() || !email.trim()}
            >
              Salvar
            </Button>
          </div>
        ) : (
          <div>
            <Button size="sm" variant="secondary" onClick={iniciarEdicao}>
              Editar nome e e-mail
            </Button>
          </div>
        )}

        <div>
          <Badge tone="primary">{user?.roleName}</Badge>
        </div>

        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            Permissões
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            {user?.permissions.map((p) => (
              <Badge key={p} tone="neutral">
                {p}
              </Badge>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={toggleTheme}>
            Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}
          </Button>
          {hasPermission('SYSTEM_SETTINGS') && (
            <LinkButton to="/auditoria" variant="secondary">
              Auditoria
            </LinkButton>
          )}
          <Button variant="danger" onClick={() => logoutMutation.mutate()} loading={logoutMutation.isPending}>
            Sair
          </Button>
        </div>
      </Card>
    </div>
  );
}
