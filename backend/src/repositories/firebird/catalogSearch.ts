import { catalogTokens } from '../../utils/catalogSearch.js';


/** Converte os bytes legados do CHERP para comparação Unicode sem diferença de caixa/acento. */
export const catalogTextColumn = (field: string): string =>
  `CAST(CAST(${field} AS VARCHAR(500) CHARACTER SET WIN1252) AS VARCHAR(500) CHARACTER SET UTF8) COLLATE UNICODE_CI_AI`;

/** Cada palavra pode estar em qualquer posição da descrição; todas devem aparecer. */
export function catalogSearchCondition(term: string, textFields: string[]): { clause: string; params: unknown[] } {
  const tokens = catalogTokens(term);
  if (!tokens.length) return { clause: '1 = 1', params: [] };
  const columns = ['UPPER(CAST(P.CODIGO AS VARCHAR(50)))', ...textFields.map(catalogTextColumn)];
  const clause = tokens.map(() => `(${columns.map((column) => `${column} LIKE ?`).join(' OR ')})`).join(' AND ');
  const params = tokens.flatMap((token) => [
    Buffer.from(`%${token.replace(/[^A-Z0-9]/g, '')}%`, 'latin1'),
    ...textFields.map(() => `%${token}%`),
  ]);
  return { clause, params };
}
