import { createHash } from 'node:crypto';
import type { Request } from 'express';

export interface RequestSource {
  ip: string;
  userAgent: string;
}

/** Hash SHA-256 de um valor de origem (IP ou User-Agent), para comparar sem guardar o valor cru. */
export function hashSource(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Extrai IP e User-Agent de uma requisição Express. */
export function extractRequestSource(request: Request): RequestSource {
  const ip = (request.ips?.length ? request.ips[0] : request.ip) ?? '';
  const userAgent = request.headers['user-agent'] ?? '';
  return { ip, userAgent };
}
