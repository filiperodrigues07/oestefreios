import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';

/**
 * Protege formulário com alteração não salva contra saída acidental: navegação interna (menu,
 * voltar do navegador, link) abre uma confirmação; fechar/recarregar a aba cai no aviso nativo
 * do navegador (`beforeunload`). Troca só de query string (ex.: `?tab=`) não conta como saída.
 *
 * Devolve o diálogo (renderizar junto com o formulário) e `liberar()`, pra chamar antes de uma
 * navegação intencional feita pelo próprio código (ex.: redirecionar depois de salvar).
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  const liberadoRef = useRef(false);
  useLayoutEffect(() => {
    dirtyRef.current = dirty;
    if (dirty) liberadoRef.current = false;
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && !liberadoRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const aviso = (event: BeforeUnloadEvent) => {
      if (liberadoRef.current) return;
      event.preventDefault();
      // Navegadores antigos só mostram o aviso com returnValue preenchido.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [dirty]);

  const liberar = useCallback(() => {
    liberadoRef.current = true;
  }, []);

  const dialog = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Sair sem salvar?"
      description="Há alterações que ainda não foram salvas. Se sair agora, o que foi digitado será perdido."
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      danger
      onCancel={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  );

  return { dialog, liberar };
}
