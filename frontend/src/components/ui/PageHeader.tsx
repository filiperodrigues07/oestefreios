import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Cabeçalho de página compartilhado, pronto para adoção gradual pelas rotas. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={className ? `${styles.header} ${className}` : styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
