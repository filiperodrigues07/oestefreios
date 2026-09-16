import { useParams } from 'react-router';
import { OSForm } from '../components/os/OSForm.js';

/** `/os/nova` e `/os/:id` caem aqui — mesma estrutura visual pros dois casos (ver OSForm). */
export function OSFormPage() {
  const { id } = useParams<{ id: string }>();
  return <OSForm mode={id ? 'edit' : 'create'} id={id} />;
}
