import styles from './Footer.module.css';

/** Rodapé institucional (item 8 da rodada de melhorias) — mesmo texto em toda tela autenticada e no login. */
export function Footer() {
  return (
    <p className={styles.footer}>
      © 2026 Rodrigues Tech · Todos os direitos reservados · Desenvolvido por{' '}
      <a href="https://www.linkedin.com/in/filipe-rodrigues07" target="_blank" rel="noopener noreferrer">
        Filipe Rodrigues
      </a>
      .
    </p>
  );
}
