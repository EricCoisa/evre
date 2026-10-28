/** Política de validade de uma confirmação pro consumidor de @RequireVerification. */
export const VerificationMethod = {
  /** Confirmado uma vez, vale pra sempre pro mesmo (purpose, target) — comportamento padrão. */
  PERMANENT: 'PERMANENT',
  /** Autoriza exatamente um uso — consumido (usedAt) no instante em que o guard libera. */
  ONCE: 'ONCE',
  /** Vale só por `ttlSeconds` a partir do `consumedAt` do código. */
  TTL: 'TTL',
} as const;

export type VerificationMethod =
  (typeof VerificationMethod)[keyof typeof VerificationMethod];
