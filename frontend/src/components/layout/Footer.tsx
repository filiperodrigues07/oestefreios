import styles from './Footer.module.css';

/** Rodapé institucional (item 8 da rodada de melhorias) — mesmo texto em toda tela autenticada e no login. */
export function Footer() {
  return (
    <p className={styles.footer}>© 2026 Oeste Freios · Todos os direitos reservados · Desenvolvido por Filipe Rodrigues.</p>
  );
}
