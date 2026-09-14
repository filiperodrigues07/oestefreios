import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { login } from '../api/auth.api.js';
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
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          width: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Entrar</h1>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Controle de Ordens de Serviço — Oeste Freios
        </p>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 14 }}>
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 14 }}>
          Senha
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
        </label>

        {mutation.isError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 14, margin: 0 }}>
            {mutation.error instanceof Error ? mutation.error.message : 'Erro ao entrar.'}
          </p>
        )}

        <button type="submit" disabled={mutation.isPending} style={buttonStyle}>
          {mutation.isPending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-background)',
  color: 'var(--color-text-primary)',
  fontSize: 14,
};

const buttonStyle: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'var(--color-primary)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
