import { useAuthStore } from '../store/authStore.js';

export function HomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>Olá, {user?.name}</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
        Perfil: {user?.roleName}. Dashboard com indicadores de OS chega na Fase 7 do roadmap.
      </p>
    </div>
  );
}
