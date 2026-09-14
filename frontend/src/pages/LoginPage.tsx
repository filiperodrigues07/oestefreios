import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { login } from '../api/auth.api.js';
import { Button, Card, Input } from '../components/ui/index.js';
import { useAuthStore } from '../store/authStore.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      navigate('/', { replace: true });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background)',
        padding: 'var(--space-4)',
      }}
    >
      <Card
        elevated
        style={{ width: 360, maxWidth: '100%' }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>Entrar</h1>
            <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
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

          <Input
            label="Senha"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {mutation.isError && (
            <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Erro ao entrar.'}
            </p>
          )}

          <Button type="submit" loading={mutation.isPending} fullWidth>
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
