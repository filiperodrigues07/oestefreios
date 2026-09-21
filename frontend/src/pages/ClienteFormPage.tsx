import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { getClienteByCodigo } from '../api/clientes.api.js';
import { ClienteForm } from '../components/clientes/ClienteForm.js';
import { Card, ErrorState, LinkButton, PageHeader, Skeleton, useToast } from '../components/ui/index.js';
import styles from './ClienteFormPage.module.css';

/** `/clientes/novo` e `/clientes/:codigo/editar` — tela própria (não modal), cadastro/edição de cliente. */
export function ClienteFormPage() {
  const { codigo } = useParams<{ codigo?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const modoEdicao = Boolean(codigo);

  const { data: cliente, isLoading, isError, error } = useQuery({
    queryKey: ['cliente', codigo],
    queryFn: () => getClienteByCodigo(codigo!),
    enabled: modoEdicao,
  });

  if (modoEdicao && isLoading) {
    return (
      <div className={styles.page}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Card>
      </div>
    );
  }

  if (modoEdicao && isError) {
    return (
      <div className={styles.page}>
        <ErrorState error={error} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={modoEdicao ? 'Editar cliente' : 'Novo cliente'}
        description={modoEdicao ? `Código ${codigo}` : 'Preencha os dados do novo cliente.'}
        actions={
          <LinkButton to="/clientes" variant="secondary">
            Voltar
          </LinkButton>
        }
      />

      <Card>
        <ClienteForm
          mode={modoEdicao ? 'edit' : 'create'}
          codigo={codigo}
          clienteInicial={cliente}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            showToast(modoEdicao ? 'Cliente atualizado.' : 'Cliente cadastrado.', 'success');
            navigate('/clientes');
          }}
          onCancel={() => navigate('/clientes')}
        />
      </Card>
    </div>
  );
}
