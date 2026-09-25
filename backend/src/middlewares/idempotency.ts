import type { NextFunction, Request, Response } from 'express';
import { failure } from '../utils/apiResponse.js';

/**
 * Idempotência para criações (OS, itens): o front manda `Idempotency-Key` (UUID). Repetir a mesma chave — duplo clique,
 * retry após timeout, replay da fila offline — devolve a resposta original em vez de criar de novo.
 *
 * Guardado em memória (1 processo): cobre reenvios em minutos/horas; um restart do serviço zera o histórico.
 * A chave vale por usuário + método + rota, então não vaza entre contas nem entre endpoints.
 * Deve vir DEPOIS do authenticate.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const MAXIMO = 5000;

interface Entrada {
  expira: number;
  /** Ausente enquanto a primeira requisição ainda está em andamento. */
  resposta?: { status: number; corpo: unknown };
}

const entradas = new Map<string, Entrada>();

export function limparIdempotencia(): void {
  entradas.clear();
}

export function idempotency(req: Request, res: Response, next: NextFunction) {
  const chave = req.header('Idempotency-Key');
  if (!chave || !req.user) return next();
  if (chave.length > 100) return failure(res, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key inválida.', 400);

  const id = `${req.user.id}|${req.method}|${req.baseUrl}${req.path}|${chave}`;
  const agora = Date.now();
  const existente = entradas.get(id);
  if (existente && existente.expira > agora) {
    if (!existente.resposta) {
      return failure(res, 'IDEMPOTENCY_IN_PROGRESS', 'Esta operação já está em andamento.', 409);
    }
    res.setHeader('Idempotent-Replay', 'true');
    return void res.status(existente.resposta.status).json(existente.resposta.corpo);
  }

  if (entradas.size >= MAXIMO) entradas.delete(entradas.keys().next().value!);
  const entrada: Entrada = { expira: agora + TTL_MS };
  entradas.set(id, entrada);

  const jsonOriginal = res.json.bind(res);
  res.json = (corpo: unknown) => {
    // Erro de servidor não é "resultado": deixa o cliente tentar de novo com a mesma chave.
    if (res.statusCode >= 500) entradas.delete(id);
    else entrada.resposta = { status: res.statusCode, corpo };
    return jsonOriginal(corpo);
  };
  res.on('close', () => {
    if (!entrada.resposta) entradas.delete(id);
  });
  next();
}
