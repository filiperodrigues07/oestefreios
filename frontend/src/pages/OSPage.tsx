import { EmptyState } from '../components/ui/index.js';

/** Lista/criação de OS chega na Fase 4 do roadmap — aqui só a casca de navegação já funcional. */
export function OSPage() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xl)' }}>Ordens de Serviço</h1>
      <EmptyState
        title="Módulo de OS em construção"
        description="Criação, edição, status e histórico de OS chegam na Fase 4 do roadmap."
      />
    </div>
  );
}
