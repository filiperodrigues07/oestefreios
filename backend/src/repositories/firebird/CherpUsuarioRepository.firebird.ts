import { firebirdQuery } from '../../database/firebird/pool.js';

export interface CherpUsuarioOption {
  chave: number;
  nome: string;
  login?: string;
}

const NAME_COLUMNS = ['NOME', 'USUARIO', 'DESCRICAO', 'NOMEUSUARIO'] as const;
const LOGIN_COLUMNS = ['LOGIN', 'APELIDO', 'CODIGO'] as const;

export class CherpUsuarioRepositoryFirebird {
  async listarAtivos(): Promise<CherpUsuarioOption[]> {
    const metadata = await firebirdQuery<{ NOME: string }>(`
      SELECT TRIM(RDB$FIELD_NAME) AS NOME
        FROM RDB$RELATION_FIELDS
       WHERE RDB$RELATION_NAME = 'USUARIOS'
    `);
    const columns = new Set(metadata.map((row) => String(row.NOME).trim().toUpperCase()));
    if (!columns.has('CHAVE')) return [];

    const nameColumn = NAME_COLUMNS.find((column) => columns.has(column));
    const loginColumn = LOGIN_COLUMNS.find((column) => columns.has(column));
    if (!nameColumn && !loginColumn) return [];

    const nameExpression = nameColumn ?? loginColumn!;
    const loginExpression = loginColumn ?? nameExpression;
    const activeFilter = columns.has('ATIVO') ? 'WHERE ATIVO = 1' : '';
    const rows = await firebirdQuery<{ CHAVE: number; NOME: string; LOGIN: string | null }>(`
      SELECT FIRST 200 CHAVE,
             CAST(${nameExpression} AS VARCHAR(100) CHARACTER SET OCTETS) AS NOME,
             CAST(${loginExpression} AS VARCHAR(100) CHARACTER SET OCTETS) AS LOGIN
        FROM USUARIOS
        ${activeFilter}
       ORDER BY ${nameExpression}
    `);
    return rows.map((row) => ({
      chave: Number(row.CHAVE),
      nome: String(row.NOME ?? row.LOGIN ?? row.CHAVE).trim(),
      login: row.LOGIN ? String(row.LOGIN).trim() : undefined,
    }));
  }
}

export const cherpUsuarioRepository = new CherpUsuarioRepositoryFirebird();
