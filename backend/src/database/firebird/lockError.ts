import { RegistroEmUsoError } from '../../errors/RegistroEmUsoError.js';

/** Gdscodes do Firebird para trava: lock_conflict, deadlock e update_conflict. */
const GDSCODES_TRAVA = new Set([335544345, 335544336, 335544451]);

const TEXTO_TRAVA =
  /statement level timeout expired|operation was cancelled|lock conflict|deadlock|update conflicts with concurrent update/i;

/** Reconhece o erro de uma GRAVAÇÃO que esbarrou numa trava (timeout de espera, conflito ou deadlock). */
export function erroDeTrava(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const gdscode = (err as { gdscode?: unknown }).gdscode;
  if (typeof gdscode === 'number' && GDSCODES_TRAVA.has(gdscode)) return true;
  const mensagem = (err as { message?: unknown }).message;
  return typeof mensagem === 'string' && TEXTO_TRAVA.test(mensagem);
}

/** `RegistroEmUsoError` se o erro for de trava; senão `null` (o chamador mantém o tratamento de antes). */
export function comoRegistroEmUso(err: unknown): RegistroEmUsoError | null {
  return erroDeTrava(err) ? new RegistroEmUsoError() : null;
}
