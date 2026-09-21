import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  key: string;
  label: string;
  mobileLabel?: string;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  children: ReactNode;
  variant?: 'underline' | 'segmented';
  fullWidth?: boolean;
}

/** Abas simples (horizontal, sublinhado na ativa) — telas de Configurações hoje, outras depois. */
export function Tabs({
  items,
  active,
  onChange,
  children,
  variant = 'underline',
  fullWidth = false,
}: TabsProps) {
  return (
    <div className={fullWidth ? styles.fullWidth : undefined}>
      <div
        className={`${styles.tablist} ${variant === 'segmented' ? styles.segmented : ''}`}
        role="tablist"
      >
        {items.map((item) => (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={active === item.key}
            className={[
              styles.tab,
              variant === 'segmented' ? styles.segmentedTab : '',
              active === item.key ? styles.tabActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(item.key)}
          >
            <span className={item.mobileLabel ? styles.desktopLabel : undefined}>{item.label}</span>
            {item.mobileLabel && <span className={styles.mobileLabel}>{item.mobileLabel}</span>}
          </button>
        ))}
      </div>
      <div className={styles.panel} role="tabpanel">
        {children}
      </div>
    </div>
  );
}
