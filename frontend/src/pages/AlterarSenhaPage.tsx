import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { changePassword } from '../api/auth.api.js';
import { Button, Card, PasswordInput } from '../components/ui/index.js';
import { useAuthStore } from '../store/authStore.js';
import { isSecurePassword, PASSWORD_RULES } from '../utils/passwordPolicy.js';
import clientLogo from '../../../img/logo-clean.png';
import styles from './PublicAuthPage.module.css';

export function AlterarSenhaPage() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => { clearSession(); navigate('/login', { replace: true }); },
  });
  const valid = isSecurePassword(newPassword) && newPassword === confirmation;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) mutation.mutate();
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Card elevated className={styles.card}>
          <form className={styles.content} onSubmit={submit}>
            <img src={clientLogo} alt="Oeste Freios" className={styles.logo} />
            <h1 className={styles.title}>Crie sua senha definitiva</h1>
            <p className={styles.copy}>Por segurança, altere a senha inicial antes de acessar o sistema.</p>
            <PasswordInput label="Senha atual" value={currentPassword} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} />
            <PasswordInput label="Nova senha" value={newPassword} maxLength={128} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} />
            <PasswordInput label="Confirmar nova senha" value={confirmation} maxLength={128} autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} />
            <div aria-live="polite" className={styles.rules}>
              {PASSWORD_RULES.map((rule) => <span key={rule.label}>{rule.test(newPassword) ? '✓' : '○'} {rule.label}</span>)}
              <span>{newPassword && newPassword === confirmation ? '✓' : '○'} Senhas iguais</span>
            </div>
            {mutation.isError && <p role="alert" className={styles.error}>{mutation.error instanceof Error ? mutation.error.message : 'Não foi possível alterar a senha.'}</p>}
            <Button type="submit" fullWidth loading={mutation.isPending} disabled={!currentPassword || !valid}>Alterar senha</Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
