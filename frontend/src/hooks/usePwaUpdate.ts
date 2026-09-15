import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useToast } from '../components/ui/ToastProvider.js';

/**
 * registerType:'autoUpdate' já troca a versão e recarrega sozinho — isto aqui
 * só avisa o usuário do que aconteceu (seção 25: "atualização automática do
 * aplicativo" + feedback claro), nunca bloqueia nem pede confirmação.
 */
export function usePwaUpdate() {
  const { showToast } = useToast();

  useEffect(() => {
    registerSW({
      immediate: true,
      onOfflineReady() {
        showToast('App pronto para uso offline.', 'info');
      },
      onRegisterError(error) {
        console.error('Falha ao registrar o service worker:', error);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
