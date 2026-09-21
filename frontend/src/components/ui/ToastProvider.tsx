import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';
import { registerToast } from './toastBus.js';

type ToastTone = 'info' | 'success' | 'warning' | 'danger';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
}

interface Toast extends ToastOptions {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;
/** Toast com ação (ex.: "Atualizar") fica mais tempo — 5s some rápido demais pra dar tempo de tocar. */
const AUTO_DISMISS_ACTION_MS = 15000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, tone: ToastTone = 'info', options?: ToastOptions) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone, ...options }]);
    setTimeout(
      () => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      },
      options?.actionLabel ? AUTO_DISMISS_ACTION_MS : AUTO_DISMISS_MS,
    );
  }, []);

  // Permite disparar toast fora da árvore React (ex.: erro global do react-query em `queryClient.ts`).
  useEffect(() => {
    registerToast(showToast);
    return () => registerToast(null);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className={styles.stack} role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`}>
              <span>{t.message}</span>
              {t.actionLabel && t.onAction && (
                <button type="button" className={styles.toastAction} onClick={t.onAction}>
                  {t.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  }
  return ctx;
}
