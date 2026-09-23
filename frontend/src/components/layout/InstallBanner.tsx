import { useEffect, useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt.js';
import styles from './InstallBanner.module.css';

const DISMISS_KEY = 'install-banner-dismissed';
const DISMISS_DURATION_MS = 5 * 60 * 1000;

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function lerDispensadoAte(): number {
  try {
    return Number(localStorage.getItem(DISMISS_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Android/Chrome tem prompt nativo de instalação (`beforeinstallprompt`, ver `useInstallPrompt`);
 * iOS Safari nunca dispara esse evento — precisa de instrução própria ("Compartilhar → Adicionar
 * à Tela de Início"). Reaparece cinco minutos após ser dispensado, se ainda não estiver instalado.
 */
export function InstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissedUntil, setDismissedUntil] = useState(lerDispensadoAte);

  useEffect(() => {
    if (!dismissedUntil) return;
    const remaining = Math.max(0, dismissedUntil - Date.now());
    const timeout = window.setTimeout(() => setDismissedUntil(0), remaining);
    return () => window.clearTimeout(timeout);
  }, [dismissedUntil]);

  if (dismissedUntil !== 0 || isStandalone()) return null;

  function dismiss() {
    const until = Date.now() + DISMISS_DURATION_MS;
    setDismissedUntil(until);
    try {
      localStorage.setItem(DISMISS_KEY, String(until));
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
