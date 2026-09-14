import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Paginação">
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        ‹
      </button>
      <span className={styles.info} aria-current="page">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Próxima página"
      >
        ›
      </button>
    </nav>
  );
}
