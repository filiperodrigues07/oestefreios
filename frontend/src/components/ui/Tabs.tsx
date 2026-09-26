import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  key: string;
  label: ReactNode;
  mobileLabel?: ReactNode;
  disabled?: boolean;
  /** Explica por que a aba está desabilitada (ex. "Disponível depois de criar a OS"). */
  title?: string;
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
  const tablistRef = useRef<HTMLDivElement>(null);
  // Abas que não cabem (celular): mostra degradê + seta só do lado que ainda tem aba escondida.
  const [sobra, setSobra] = useState({ esquerda: false, direita: false });
  const medirSobra = useCallback(() => {
    const el = tablistRef.current;
    if (!el) return;
    const esquerda = el.scrollLeft > 4;
    const direita = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setSobra((atual) => (atual.esquerda === esquerda && atual.direita === direita ? atual : { esquerda, direita }));
  }, []);

  useEffect(() => {
    const el = tablistRef.current;
    if (!el) return;
    medirSobra();
    const observer = new ResizeObserver(medirSobra);
    observer.observe(el);
    return () => observer.disconnect();
  }, [medirSobra, items.length]);

  function rolar(direcao: 1 | -1) {
    tablistRef.current?.scrollBy({ left: direcao * tablistRef.current.clientWidth * 0.7, behavior: 'smooth' });
  }

  useEffect(() => {
    const selected = Array.from(tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
      .find((tab) => tab.dataset.tabKey === active);
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <div className={fullWidth ? styles.fullWidth : undefined}>
      <div className={styles.tablistWrap}>
      <div
        ref={tablistRef}
        className={[
          styles.tablist,
          variant === 'segmented' ? styles.segmented : '',
          sobra.esquerda ? styles.sobraEsquerda : '',
          sobra.direita ? styles.sobraDireita : '',
        ].filter(Boolean).join(' ')}
        role="tablist"
        onScroll={medirSobra}
      >
        {items.map((item) => (
          <button
            key={item.key}
            data-tab-key={item.key}
            role="tab"
            type="button"
            aria-selected={active === item.key}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            title={item.title}
            className={[
              styles.tab,
              variant === 'segmented' ? styles.segmentedTab : '',
              active === item.key ? styles.tabActive : '',
              item.disabled ? styles.tabDisabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => !item.disabled && onChange(item.key)}
          >
            <span className={item.mobileLabel ? styles.desktopLabel : undefined}>{item.label}</span>
            {item.mobileLabel && <span className={styles.mobileLabel}>{item.mobileLabel}</span>}
          </button>
        ))}
      </div>
      {/* Setas só para toque/mouse: pelo teclado as abas já rolam sozinhas até a focada. */}
      {sobra.esquerda && (
        <button type="button" tabIndex={-1} aria-hidden="true" className={`${styles.seta} ${styles.setaEsquerda}`} onClick={() => rolar(-1)}>‹</button>
      )}
      {sobra.direita && (
        <button type="button" tabIndex={-1} aria-hidden="true" className={`${styles.seta} ${styles.setaDireita}`} onClick={() => rolar(1)}>›</button>
      )}
      </div>
      <div className={styles.panel} role="tabpanel">
        {children}
      </div>
    </div>
  );
}
