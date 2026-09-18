/** Asterisco vermelho pra marcar campo obrigatório nos formulários da OS. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>
      {' '}
      *
    </span>
  );
}
