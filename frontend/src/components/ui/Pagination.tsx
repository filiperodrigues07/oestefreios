import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Quando informado, mostra o seletor de "registros por página" — mesma posição em toda tela paginada. */
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}

const DEFAULT_LIMIT_OPTIONS = [10, 20, 50, 100];

export function Pagination({ page, limit, total, onPageChange, onLimitChange, limitOptions = DEFAULT_LIMIT_OPTIONS }: PaginationProps) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className={styles.wrapper}>
      {onLimitChange ? (
        <label className={styles.limitControl}>
          Mostrar
          <select
            className={styles.limitSelect}
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Registros por página"
          >
            {limitOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          por página
        </label>
      ) : (
        <span />
      )}

      {totalPages > 1 && (
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
      )}
    </div>
  );
}
