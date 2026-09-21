import { useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt.js';
import styles from './InstallBanner.module.css';

const DISMISS_KEY = 'install-banner-dismissed';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function lerDispensado(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Android/Chrome tem prompt nativo de instalação (`beforeinstallprompt`, ver `useInstallPrompt`);
 * iOS Safari nunca dispara esse evento — precisa de instrução própria ("Compartilhar → Adicionar
 * à Tela de Início"). Só aparece se ainda não estiver instalado e a pessoa não tiver dispensado antes.
 */
export function InstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(lerDispensado);

  if (dismissed || isStandalone()) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Navegador privado/bloqueado — só não lembra a próxima vez, sem quebrar nada.
    }
  }

  if (canInstall) {
    return (
      <div className={styles.banner} role="note">
        <span>Instale o app na tela de início pra abrir mais rápido, até offline.</span>
        <div className={styles.actions}>
          <button type="button" className={styles.installButton} onClick={promptInstall}>
            Instalar
          </button>
          <button type="button" className={styles.dismissButton} onClick={dismiss} aria-label="Dispensar aviso de instalação">
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (isIos()) {
    return (
      <div className={styles.banner} role="note">
        <span>
          Adicione à Tela de Início: toque em <strong>Compartilhar</strong> (▢↑) e depois em{' '}
          <strong>Adicionar à Tela de Início</strong>.
        </span>
        <button type="button" className={styles.dismissButton} onClick={dismiss} aria-label="Dispensar aviso de instalação">
          ✕
        </button>
      </div>
    );
  }

  return null;
}
