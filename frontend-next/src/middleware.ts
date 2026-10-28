import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { API_PATHS } from '@/lib/generated/paths';
import { readSetCookie, refreshSession, type RefreshedSession } from '@/lib/api/session-refresh';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/access-denied',
  '/admin',
  // Conector MCP: proxy para o backend, com autenticação Bearer/PKCE própria.
  '/mcp',
  '/oauth',
  '/.well-known',
  '/legal',
  '/s',
];
const PUBLIC_EXACT = ['/'];

/** Telas privadas sem linha em `Route`: redirecionam para um destino que passa pelo check. */
const UNCHECKED_PRIVATE_PATHS = ['/redirect'];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Verdadeiro só para navegação real: exclui server action (`next-action`) e prefetch do router. */
function isNavigation(request: NextRequest): boolean {
  const headers = request.headers;
  return (
    !headers.get('next-action') && !headers.get('next-router-prefetch')
  );
}

/** Repassa o IP do browser ao backend via header x-forwarded-for. */
function forwardedFor(request: NextRequest): { 'x-forwarded-for'?: string } {
  const ip = request.headers.get('x-forwarded-for');
  return ip ? { 'x-forwarded-for': ip } : {};
}

/** Renova a sessão a partir do refresh_token do request; `null` se não houver cookie ou a renovação falhar. */
function renewSession(request: NextRequest): Promise<RefreshedSession | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  return refreshToken ? refreshSession(refreshToken, forwardedFor(request)) : Promise.resolve(null);
}

type AccessCheck = { status: number; allowed: boolean };

/** Consulta o acesso à rota: nega só em `200` com `false` ou `403`; qualquer outra resposta falha aberta, sem bloquear. */
async function checkRouteAccess(
  request: NextRequest,
  path: string,
  accessToken: string,
): Promise<AccessCheck | null> {
  try {
    const res = await fetch(
      `${BASE_URL}${API_PATHS.USER_ROUTE_ACCESS_ME}?path=${encodeURIComponent(path)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...forwardedFor(request),
        },
        cache: 'no-store',
      },
    );
    if (res.ok) return { status: res.status, allowed: (await res.json()) === true };
    // 401 sobe para o chamador renovar a sessão; 403 é negação real.
    if (res.status === 401 || res.status === 403) {
      return { status: res.status, allowed: false };
    }
    return null;
  } catch {
    // Fail-open — infra down shouldn't lock users out
    return null;
  }
}

/** Sessão acabou de verdade: limpa os cookies mortos e avisa o usuário no /login. */
function sessionExpired(request: NextRequest, pathname: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
  loginUrl.searchParams.set('expired', '1');

  const response = NextResponse.redirect(loginUrl);
  // Sem isto o access_token morto continua no browser e o middleware tentaria
  // validá-lo de novo a cada navegação.
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

type SessionState = { accessToken: string; refreshed: RefreshedSession | null };

/** Garante um access token: manda pro /login sem nenhum cookie, renova se só o access morreu. */
async function ensureAuthenticated(
  request: NextRequest,
  pathname: string,
): Promise<{ redirect: NextResponse } | SessionState> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefresh = request.cookies.has(REFRESH_COOKIE);

  if (!accessToken && !hasRefresh) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    // `set` já codifica o valor; encodar aqui produziria "%2Fdashboard", que safeCallbackUrl rejeita.
    loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
    return { redirect: NextResponse.redirect(loginUrl) };
  }

  if (accessToken) return { accessToken, refreshed: null };

  // Access token expirado (ou cookie já descartado pelo browser) mas com refresh
  // em mãos: renova aqui, antes do layout privado ver a sessão como ausente.
  const refreshed = await renewSession(request);
  if (!refreshed) return { redirect: sessionExpired(request, pathname) };
  return { accessToken: refreshed.accessToken, refreshed };
}

/** Rota privada sem linha em `Route` (ex.: `/redirect`) ou navegação sintética não passam pelo backend. */
function shouldCheckRouteAccess(request: NextRequest, pathname: string): boolean {
  // O pathname inteiro sobe: o backend casa a rota cadastrada mais específica
  // (subrota) e cai no ancestral quando o segmento é dinâmico ([id]).
  const segments = pathname.split('/').filter(Boolean);
  const basePath = segments.length > 0 ? segments[0] : '';
  return !!basePath && !UNCHECKED_PRIVATE_PATHS.includes(`/${basePath}`) && isNavigation(request);
}

/** Confere acesso à rota no backend; renova a sessão uma vez se ele disser 401. */
async function enforceRouteAccess(
  request: NextRequest,
  pathname: string,
  session: SessionState,
): Promise<{ redirect: NextResponse } | SessionState> {
  let { accessToken, refreshed } = session;
  let access = await checkRouteAccess(request, pathname, accessToken);

  // 401 aqui é token morto, não falta de permissão: renova uma vez antes de desistir.
  if (access?.status === 401 && !refreshed) {
    refreshed = await renewSession(request);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      access = await checkRouteAccess(request, pathname, accessToken);
    }
  }

  if (access?.status === 401) return { redirect: sessionExpired(request, pathname) };

  // Negação de permissão vai para /access-denied, que é público — /redirect reentraria aqui em loop.
  if (access && !access.allowed) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = '/access-denied';
    deniedUrl.search = '';
    return { redirect: NextResponse.redirect(deniedUrl) };
  }

  return { accessToken, refreshed };
}

/** O Payload CMS só pode ser acessado dentro da página /cms — navegação direta de documento (nova
 * guia ou barra de endereço) redireciona para /cms preservando a rota. */
function redirectAdminToCms(request: NextRequest, pathname: string): NextResponse | null {
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
  if (!isAdminPath || request.headers.get('sec-fetch-dest') !== 'document') return null;

  const cmsUrl = request.nextUrl.clone();
  cmsUrl.pathname = '/cms'; // APINEXT: rota de página interna do frontend
  cmsUrl.search = '';
  if (pathname !== '/admin' && pathname !== '/admin/') {
    cmsUrl.searchParams.set('path', pathname + request.nextUrl.search);
  }
  return NextResponse.redirect(cmsUrl);
}

/** Cookie header com o access token novo e o refresh (do Set-Cookie da renovação, ou o que já havia). */
function buildRefreshedCookieHeader(
  request: NextRequest,
  accessToken: string,
  refreshed: RefreshedSession,
): string {
  const refreshValue =
    readSetCookie(refreshed.setCookies, REFRESH_COOKIE) ??
    request.cookies.get(REFRESH_COOKIE)?.value ??
    '';
  return `${ACCESS_COOKIE}=${accessToken}; ${REFRESH_COOKIE}=${refreshValue}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always inject x-pathname (used by layouts)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const adminRedirect = redirectAdminToCms(request, pathname);
  if (adminRedirect) return adminRedirect;

  let refreshed: RefreshedSession | null = null;

  if (!isPublic(pathname)) {
    const auth = await ensureAuthenticated(request, pathname);
    if ('redirect' in auth) return auth.redirect;
    let { accessToken } = auth;
    refreshed = auth.refreshed;

    if (shouldCheckRouteAccess(request, pathname)) {
      const access = await enforceRouteAccess(request, pathname, { accessToken, refreshed });
      if ('redirect' in access) return access.redirect;
      accessToken = access.accessToken;
      refreshed = access.refreshed;
    }

    // O RSC desta mesma request precisa enxergar o token novo, senão o layout
    // privado leria o cookie antigo (já morto) e mandaria o usuário ao /login.
    if (refreshed) {
      requestHeaders.set('cookie', buildRefreshedCookieHeader(request, accessToken, refreshed));
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // E o browser precisa guardar os cookies novos, senão a próxima navegação
  // renovaria tudo de novo.
  if (refreshed) {
    for (const cookie of refreshed.setCookies) {
      response.headers.append('set-cookie', cookie);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|media|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
