import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useToast } from '../components/ui/ToastProvider.js';

/**
 * registerType:'autoUpdate' já ativa o novo service worker sozinho em segundo plano — mas quem
 * já está com o app aberto (comum numa oficina, tablet/celular ligado o dia todo) continua rodando
 * o JS antigo até recarregar a página. `onNeedRefresh` avisa e oferece um toque pra recarregar
 * na hora, em vez de deixar a pessoa presa numa versão desatualizada sem saber.
 */
export function usePwaUpdate() {
  const { showToast } = useToast();

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        showToast('Nova versão disponível.', 'info', {
          actionLabel: 'Atualizar',
          onAction: () => updateSW(true),
        });
      },
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
