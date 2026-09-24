import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { login } from '../api/auth.api.js';
import { Footer } from '../components/layout/Footer.js';
import { Button, Card, Input, PasswordInput } from '../components/ui/index.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useAuthStore } from '../store/authStore.js';
import styles from './LoginPage.module.css';
import clientLogo from '../../../img/logo-clean.webp';
import truckHero from '../assets/login-truck-hero.webp';

const AVISOS_LOGIN: Record<string, string> = {
  'sessao-encerrada': 'Sua sessão foi encerrada. Isso acontece quando a conta entra em outro dispositivo ou um administrador encerra o acesso. Entre novamente.',
  licenca: 'Limite de licenças em uso. Tente novamente em alguns minutos ou peça a um administrador para liberar uma vaga.',
};

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const aviso = AVISOS_LOGIN[searchParams.get('motivo') ?? ''];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const online = useOnlineStatus();

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      navigate(data.user.mustChangePassword ? '/alterar-senha' : '/', { replace: true });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div className={styles.page} style={{ '--login-hero': `url(${truckHero})` } as CSSProperties}>
      <main className={styles.main}>
        <section className={styles.intro} aria-label="Oeste Freios">
          <div className={styles.logoFrame}>
            <img className={styles.brandLogo} src={clientLogo} alt="Oeste Freios" />
          </div>
          <p className={styles.introTagline}>Gestão inteligente para sua oficina.</p>
          <p className={styles.introCopy}>
            Controle as ordens de serviço, produtos e clientes em uma única plataforma.
          </p>
        </section>

        <Card elevated className={styles.card}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.heading}>
              <div className={styles.mobileLogoFrame}>
                <img className={styles.mobileBrandLogo} src={clientLogo} alt="Oeste Freios" />
              </div>
              <h1>Entrar</h1>
              <p>
                Controle de Ordens de Serviço — Oeste Freios
              </p>
            </div>

            <Input
              label="E-mail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <div>
            <PasswordInput
              label="Senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
              onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
              onBlur={() => setCapsLock(false)}
              autoComplete="current-password"
            />
            {capsLock && <p role="status" aria-live="polite" className={styles.capsLock}>Caps Lock ativado</p>}
            </div>

            {aviso && !mutation.isError && (
              <p role="status" className={styles.warning}>{aviso}</p>
            )}

            {!online && (
              <p role="alert" className={styles.warning}>
                Você está offline. Por segurança, a sessão não fica salva no aparelho — conecte-se à internet para entrar.
              </p>
            )}

            {online && mutation.isError && (
              <p role="alert" className={styles.error}>
                {mutation.error instanceof Error ? mutation.error.message : 'Erro ao entrar.'}
              </p>
            )}

            <Button type="submit" loading={mutation.isPending} disabled={!online} fullWidth>
              Entrar
            </Button>

            <Link to="/esqueci-senha" className={styles.resetLink}>
              Esqueci minha senha
            </Link>

            <p className={styles.secure}>Acesso seguro</p>
          </form>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
