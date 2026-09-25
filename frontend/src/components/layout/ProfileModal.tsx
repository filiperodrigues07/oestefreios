import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { logout, updateMyProfile, updateMyProfilePhoto } from '../../api/auth.api.js';
import { getGeralSettings, saveGeralSettings } from '../../api/settings.api.js';
import { clearOfflineQueue } from '../../pwa/offlineQueue.js';
import { clearLegacyApiCache } from '../../pwa/apiCache.js';
import { queryClient } from '../../api/queryClient.js';
import { Avatar, Button, Input, Modal, useToast } from '../ui/index.js';
import { hasPermission, useAuthStore } from '../../store/authStore.js';
import { useThemeStore } from '../../store/themeStore.js';
import styles from './ProfileModal.module.css';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

/** Modal "Meu perfil": dados da conta, perfil de acesso e cor de destaque (se SYSTEM_SETTINGS). */
export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { showToast } = useToast();
  const podeConfigurarSistema = hasPermission('SYSTEM_SETTINGS');

  const [editando, setEditando] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const photoInputRef = useRef<HTMLInputElement>(null);

  function fechar() {
    setEditando(false);
    onClose();
  }

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
    onSettled: async () => {
      await Promise.allSettled([clearOfflineQueue(), clearLegacyApiCache()]);
      queryClient.clear();
      clearSession();
      onClose();
      window.location.assign('/login');
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

  if (!user) return null;

  return (
    <Modal open={open} title="Meu perfil" onClose={fechar}>
      <div className={styles.body}>
        <div className={styles.identity}>
          <div className={styles.photoControl}>
            <Avatar name={user.name} photoUrl={user.photoUrl ?? undefined} size={64} />
            <input
              ref={photoInputRef}
              className={styles.photoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => selecionarFoto(event.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="secondary"
              loading={photoMutation.isPending}
              onClick={() => photoInputRef.current?.click()}
            >
              Alterar foto
            </Button>
          </div>
          {!editando ? (
            <div>
              <div className={styles.name}>{user.name}</div>
              <div className={styles.email}>{user.email}</div>
              <div className={styles.role}>{user.roleName}</div>
            </div>
          ) : (
            <div className={styles.editFields}>
              <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
        </div>

        {saveMutation.isError && (
          <p role="alert" className={styles.error}>
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'Erro ao salvar perfil.'}
          </p>
        )}
        {photoMutation.isError && (
          <p role="alert" className={styles.error}>
            {photoMutation.error instanceof Error
              ? photoMutation.error.message
              : 'Erro ao enviar a foto.'}
          </p>
        )}

        {editando ? (
          <div className={styles.actionsRow}>
            <Button size="sm" variant="secondary" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!name.trim() || !email.trim()}
            >
              Salvar
            </Button>
          </div>
        ) : (
          <div className={styles.actionsRow}>
            <Button size="sm" variant="secondary" onClick={iniciarEdicao}>
              Editar nome e e-mail
            </Button>
          </div>
        )}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tema</h3>
          <Button size="sm" variant="secondary" onClick={toggleTheme}>
            {theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          </Button>
        </section>

        {podeConfigurarSistema && <AccentColorSection />}

        <div className={styles.actionsRow}>
          <Button
            size="sm"
            variant="danger"
            onClick={() => logoutMutation.mutate()}
            loading={logoutMutation.isPending}
          >
            Sair
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Cor de destaque global (Configurações > Geral) — mesma configuração, atalho pra quem administra o sistema. */
function AccentColorSection() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data } = useQuery({ queryKey: ['settings', 'geral'], queryFn: getGeralSettings });
  const [cor, setCor] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (corDestaque: string) => saveGeralSettings({ ...data!, corDestaque }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings', 'geral'], saved);
      queryClient.setQueryData(
        ['branding'],
        (old: { nomeEmpresa: string; logoUrl: string; corDestaque: string } | undefined) =>
          old ? { ...old, corDestaque: saved.corDestaque } : old,
      );
      showToast('Cor de destaque atualizada.', 'success');
    },
  });

  if (!data) return null;
  const corAtual = cor ?? data.corDestaque ?? '#0369a1';

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Cor de destaque</h3>
      <div className={styles.accentRow}>
        <input
          type="color"
          value={corAtual}
          onChange={(e) => setCor(e.target.value)}
          className={styles.colorInput}
          aria-label="Cor de destaque"
        />
        <Button
          size="sm"
          onClick={() => saveMutation.mutate(corAtual)}
          loading={saveMutation.isPending}
          disabled={corAtual === data.corDestaque}
        >
          Salvar
        </Button>
      </div>
    </section>
  );
}
