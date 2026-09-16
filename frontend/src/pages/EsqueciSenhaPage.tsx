import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router';
import { forgotPassword } from '../api/auth.api.js';
import { Footer } from '../components/layout/Footer.js';
import { Button, Card, Input } from '../components/ui/index.js';
import truckHero from '../assets/login-truck-hero.png';
import styles from './PublicAuthPage.module.css';

/** "Esqueci minha senha" (item 10): sempre mostra a mesma mensagem genérica, exista ou não o e-mail. */
export function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div className={styles.page} style={{ '--auth-hero': `url(${truckHero})` } as CSSProperties}>
      <main className={styles.main}>
      <Card elevated className={styles.card}>
        {mutation.isSuccess ? (
          <div className={styles.content}>
            <h1 className={styles.title}>Verifique seu e-mail</h1>
            <p className={styles.copy}>
              Se esse e-mail estiver cadastrado, você receberá um link de redefinição em instantes.
            </p>
            <Link to="/login" className={styles.link}>
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.content}>
            <div>
              <h1 className={styles.title}>Esqueci minha senha</h1>
              <p className={styles.copy}>
                Informe seu e-mail cadastrado e enviaremos um link de redefinição.
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

            <Button type="submit" loading={mutation.isPending} fullWidth>
              Enviar link de redefinição
            </Button>

            <Link to="/login" className={`${styles.link} ${styles.centered}`}>
              Voltar para o login
            </Link>
          </form>
        )}
      </Card>
      </main>
      <Footer />
    </div>
  );
}
