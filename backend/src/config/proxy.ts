/**
 * Quantos proxies confiáveis existem na frente do Express. Em produção o nginx (1 salto) repassa o IP real em
 * X-Forwarded-For; sem isso `req.ip` vira 127.0.0.1 e TODOS os usuários dividem o mesmo limite de tentativas
 * (um atacante trava o login de todo mundo) e a auditoria grava o IP errado. Fora de produção não há proxy:
 * confiar em X-Forwarded-For deixaria qualquer cliente forjar o próprio IP.
 */
export function trustProxyHops(nodeEnv: string): number {
  return nodeEnv === 'production' ? 1 : 0;
}
