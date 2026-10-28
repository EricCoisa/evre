import { NextResponse } from 'next/server';

/** Repassa os cabeçalhos 'set-cookie' recebidos do backend para a resposta do Next.js. */
export function forwardSetCookies(response: NextResponse, setCookie?: string | string[]): void {
  if (!setCookie) return;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookie of cookies) {
    response.headers.append('set-cookie', cookie);
  }
}

