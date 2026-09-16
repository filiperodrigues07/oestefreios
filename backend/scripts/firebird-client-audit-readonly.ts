import { firebirdQuery } from '../src/database/firebird/pool.js';
import { applyStoredFirebirdSettings } from '../src/services/settings.service.js';

async function main() {
  await applyStoredFirebirdSettings();
  const clientes = await firebirdQuery(
    `SELECT FIRST 12
            C.CHAVE, C.ATIVO, C.CHAVEEMPRESA, C.CODIGO, C.CLIENTE, C.FORNECEDOR,
            C.TRANSPORTADOR, C.REPRESENTANTE, C.PESSOA, C.RAZAOSOCIAL, C.FANTASIA,
            C.CNPJCPF, C.ENDERECO, C.NUMERO, C.BAIRRO, C.COMPLEMENTO, C.CHAVECIDADE,
            CID.CIDADE, CID.UF, C.CEP, C.TELEFONE, C.CELULAR, C.EMAIL,
            C.REGIMETRIBUTARIO, C.CHAVETABELAPRECO, C.CHAVECONDPGTO,
            C.CHAVEUSUARIOCAD, C.DATAHORACAD, C.DATAHORAALT
       FROM CLIFOR C
       LEFT JOIN CIDADE CID ON CID.CHAVE = C.CHAVECIDADE
      ORDER BY C.CHAVE DESC`,
  );
  console.log(JSON.stringify({ clientes }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
