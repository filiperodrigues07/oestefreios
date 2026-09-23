import { useEffect, useState, type ReactNode } from 'react';
import { getBranding, type Branding } from '../../api/settings.api.js';
import { queryClient } from '../../api/queryClient.js';
import { useAuthStore } from '../../store/authStore.js';
import clientLogo from '../../../../img/logo-clean.webp';
import { getErrorPresentation } from '../../utils/errorPresentation.js';
import { Button } from './Button.js';
import styles from './ErrorScreen.module.css';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

interface ErrorScreenProps {
  error?: unknown;
  fullPage?: boolean;
  title?: string;
  description?: string;
  action?: ReactNode;
}

/** Funciona também fora do Router e dos providers, como última proteção do aplicativo. */
export function ErrorScreen({
  error,
  fullPage = true,
  title,
  description,
  action,
}: ErrorScreenProps) {
  const online = useOnlineStatus();
  const presentation = getErrorPresentation(error, !online);
  const [branding, setBranding] = useState<Branding | undefined>(() =>
    queryClient.getQueryData<Branding>(['branding']),
  );

  useEffect(() => {
    if (!fullPage || branding || useAuthStore.getState().status !== 'authenticated') return;
    let active = true;
    queryClient.fetchQuery({ queryKey: ['branding'], queryFn: getBranding, staleTime: 5 * 60_000 })
      .then((result) => {
        if (active) setBranding(result);
      })
      .catch(() => {
        // A tela de erro deve continuar utilizável sem conexão com a API.
      });
    return () => { active = false; };
  }, [fullPage, branding]);

  const content = (
    <section className={styles.card} role="alert" aria-label={title ?? presentation.title}>
      {fullPage && (
        <div className={styles.brand}>
          <img
            className={styles.brandLogo}
            src={branding?.logoUrl || clientLogo}
            alt={branding?.nomeEmpresa || 'Oeste Freios'}
            onError={(event) => {
              if (event.currentTarget.src !== new URL(clientLogo, window.location.href).href) {
                event.currentTarget.src = clientLogo;
              }
            }}
          />
          <span>Controle de ordens de serviço</span>
        </div>
      )}
      <div className={styles.illustration} aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none">
          <circle
            cx="60"
            cy="60"
            r="48"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 7"
          />
          <path
            d="M40 28h30l14 14v50H36V32a4 4 0 0 1 4-4Z M70 28v16h14 M48 58h24 M48 68h14"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="83"
            cy="85"
            r="17"
            fill="var(--color-surface)"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M83 76v10 M83 92h.01"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className={styles.code}>{presentation.code}</span>
      {fullPage ? (
        <h1 className={styles.title}>{title ?? presentation.title}</h1>
      ) : (
        <h2 className={styles.title}>{title ?? presentation.title}</h2>
      )}
      <p className={styles.description}>{description ?? presentation.description}</p>
      <div className={styles.actions}>
        {presentation.recovery === 'login' ? (
          <a className={styles.primaryLink} href="/login">
            Entrar novamente
          </a>
        ) : (
          (action ??
          (presentation.recovery === 'retry' && (
            <Button onClick={() => window.location.reload()}>Recarregar página</Button>
          )))
        )}
        {(fullPage || (!action && presentation.recovery === 'home')) && (
          <a className={styles.homeLink} href="/">
            Voltar ao início
          </a>
        )}
      </div>
    </section>
  );
  return fullPage ? (
    <main className={styles.page}>{content}</main>
  ) : (
    <div className={styles.inline}>{content}</div>
  );
}
