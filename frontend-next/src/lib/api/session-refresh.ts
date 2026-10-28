import { API_PATHS } from '@/lib/generated/paths';
import { apiTarget } from '@/lib/api/mcp-proxy';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';

export type RefreshedSession = { accessToken: string; setCookies: string[] };

/** Extrai o valor de um cookie de dentro de um header `set-cookie`. */
export function readSetCookie(setCookies: string[], name: string): string | undefined {
  for (const raw of setCookies) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0 && pair.slice(0, idx).trim() === name) {
      return pair.slice(idx + 1);
    }
  }
  return undefined;
}

async function requestRefresh(
  refreshToken: string,
  extraHeaders?: Record<string, string>,
): Promise<RefreshedSession | null> {
  try {
    const res = await fetch(apiTarget(API_PATHS.AUTH_REFRESH), {
      method: 'POST',
      headers: {
        Cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const setCookies = res.headers.getSetCookie();
    const accessToken = readSetCookie(setCookies, ACCESS_COOKIE);
    return accessToken ? { accessToken, setCookies } : null;
  } catch {
    return null;
  }
}

const inFlight = new Map<string, Promise<RefreshedSession | null>>();

/** Renova a sessão no backend a partir do refresh_token; chamadas concorrentes com o mesmo token compartilham a renovação em curso. */
export function refreshSession(
  refreshToken: string,
  extraHeaders?: Record<string, string>,
): Promise<RefreshedSession | null> {
  let pending = inFlight.get(refreshToken);
  if (!pending) {
    pending = requestRefresh(refreshToken, extraHeaders).finally(() => {
      inFlight.delete(refreshToken);
    });
    inFlight.set(refreshToken, pending);
  }
  return pending;
}
