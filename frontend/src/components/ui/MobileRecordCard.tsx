import type { ReactNode } from 'react';
import styles from './MobileRecordCard.module.css';

export interface MobileRecordField {
  label: string;
  value: ReactNode;
  mono?: boolean;
  wide?: boolean;
}

interface MobileRecordCardProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  fields?: MobileRecordField[];
  actions?: ReactNode;
}

export function MobileRecordCard({
  eyebrow,
  title,
  subtitle,
  status,
  fields = [],
  actions,
}: MobileRecordCardProps) {
  return (
    <>
      <div className={styles.header}>
        <div className={styles.identity}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <strong className={styles.title}>{title}</strong>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        {status && <div className={styles.status}>{status}</div>}
      </div>
      {fields.length > 0 && (
        <div className={styles.fields}>
          {fields.map((field) => (
            <div key={field.label} className={field.wide ? styles.wide : undefined}>
              <span>{field.label}</span>
              <b className={field.mono ? styles.mono : undefined}>{field.value}</b>
            </div>
          ))}
        </div>
      )}
      {actions && (
        <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
          {actions}
        </div>
      )}
    </>
  );
}
