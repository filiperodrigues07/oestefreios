import { hash, verify } from '@node-rs/argon2';

// Valor numérico do enum ambiente Algorithm.Argon2id — importar o const enum
// como valor falha sob isolatedModules, então usamos o literal diretamente.
const ARGON2ID = 2;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, { algorithm: ARGON2ID });
}

export function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  return verify(hashed, plain);
}
