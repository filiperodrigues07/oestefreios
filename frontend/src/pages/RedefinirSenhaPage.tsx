import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { resetPassword } from '../api/auth.api.js';
import { Footer } from '../components/layout/Footer.js';
import { Button, Card, PasswordInput, useToast } from '../components/ui/index.js';
import truckHero from '../assets/login-truck-hero.png';
import styles from './PublicAuthPage.module.css';
import { isSecurePassword, PASSWORD_RULES } from '../utils/passwordPolicy.js';

/** Tela pública /redefinir-senha?token=... — fora do ProtectedRoute (item 10). */
export function RedefinirSenhaPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: () => {
      showToast('Senha redefinida com sucesso. Faça login com a nova senha.', 'success');
      navigate('/login', { replace: true });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSecurePassword(password)) {
      setErroValidacao('A senha ainda não atende a todos os critérios de segurança.');
      return;
    }
    if (password !== confirmacao) {
      setErroValidacao('As senhas não coincidem.');
      return;
    }
    setErroValidacao(null);
    mutation.mutate();
  }

  return (
    <div className={styles.page} style={{ '--auth-hero': `url(${truckHero})` } as CSSProperties}>
      <main className={styles.main}>
      <Card elevated className={styles.card}>
        {!token ? (
          <div className={styles.content}>
            <h1 className={styles.title}>Link inválido</h1>
            <p className={styles.copy}>
              Este link de redefinição está incompleto. Peça um novo link na tela de login.
            </p>
            <Link to="/login" className={styles.link}>
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.content}>
            <div>
              <h1 className={styles.title}>Redefinir senha</h1>
              <p className={styles.copy}>
                Escolha uma nova senha para sua conta.
              </p>
            </div>

            <PasswordInput
              label="Nova senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
            />
            <PasswordInput
              label="Confirmar nova senha"
              required
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
            />

            <div aria-live="polite" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, color: '#adc7e9', fontSize: 12 }}>
              {PASSWORD_RULES.map((rule) => <span key={rule.label}>{rule.test(password) ? '✓' : '○'} {rule.label}</span>)}
              <span>{password && password === confirmacao ? '✓' : '○'} Senhas iguais</span>
            </div>

            {(erroValidacao || mutation.isError) && (
              <p role="alert" className={styles.error}>
                {erroValidacao ?? (mutation.error instanceof Error ? mutation.error.message : 'Erro ao redefinir senha.')}
              </p>
            )}

            <Button type="submit" loading={mutation.isPending} fullWidth>
              Redefinir senha
            </Button>
          </form>
        )}
      </Card>
      </main>
      <Footer />
    </div>
  );
}
