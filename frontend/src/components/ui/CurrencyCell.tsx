import styles from './CurrencyCell.module.css';

/** Mantém o símbolo à esquerda da célula e o valor à direita. */
export function CurrencyCell({ amount }: { amount: string }) {
  return (
    <span className={styles.currencyCell}>
      <span>R$</span>
      <span>{amount}</span>
    </span>
  );
}
