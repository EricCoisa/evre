/** Lê o campo `exp` (epoch em segundos) de um JWT já assinado, sem verificar assinatura. */
export function jwtExp(token: string): number {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('jwtExp: token sem payload');
  const { exp } = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { exp?: number };
  if (typeof exp !== 'number') throw new Error('jwtExp: token sem claim exp');
  return exp;
}
