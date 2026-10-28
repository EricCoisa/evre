import { headers } from 'next/headers';

/** Repassa o IP do browser ao backend via header x-forwarded-for. */
export async function clientIpHeader(): Promise<{ 'x-forwarded-for'?: string }> {
  try {
    const ip = (await headers()).get('x-forwarded-for');
    return ip ? { 'x-forwarded-for': ip } : {};
  } catch {
    // Headers() lança fora de um request scope (build/SSG) — segue sem IP
    return {};
  }
}
