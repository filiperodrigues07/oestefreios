import { Link } from 'react-router';
import styles from './MobileFab.module.css';

interface MobileFabProps {
  label: string;
  to?: string;
  onClick?: () => void;
}

export function MobileFab({ label, to, onClick }: MobileFabProps) {
  const content = (
    <>
      <span aria-hidden="true">+</span>
      <b>{label}</b>
    </>
  );
  return to ? (
    <Link to={to} className={styles.fab} aria-label={label}>
      {content}
    </Link>
  ) : (
    <button type="button" className={styles.fab} aria-label={label} onClick={onClick}>
      {content}
    </button>
  );
}
