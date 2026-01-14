"use server"

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserRouteAccessByPath } from '../access/userRoute/api';
import { getCurrentUser } from './api';
import type { AuthUser } from './types';

type RouteContext = 'admin' | 'client';

const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token';
/**
 * Salva access_token no cookie
 */
export async function setServerAccessToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 15 * 60, // 15 minutos em segundos
  });
}

/**
 * Salva refresh_token no cookie
 */
export async function setServerRefreshToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 dias em segundos
  });
}

/**
 * Obtém refresh_token do cookie (Server-Side)
 */
export async function getServerRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
}

/**
 * Remove access_token do cookie
 */
export async function deleteServerAccessToken() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
}

/**
 * Remove refresh_token do cookie
 */
export async function deleteServerRefreshToken() {
  const cookieStore = await cookies();
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

export async function getAuthHeaders(): Promise<{ Authorization?: string } | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;
  return { Authorization: `Bearer ${accessToken}` };
}


/**
 * Obtém access_token do cookie (Server-Side)
 */
export async function getServerAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getServerLang(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("i18nextLng")?.value;
}

// Rotas públicas que não precisam de validação de acesso
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password'];

// Rotas que não verificam permissão específica (apenas autenticação)
const AUTH_ONLY_ROUTES = ['/', '/redirect', '/access-denied'];

// Cache simples para evitar múltiplas validações da mesma rota na mesma request
const routeAccessCache = new Map<string, { hasAccess: boolean; timestamp: number }>();
const CACHE_TTL = 1000; // 1 segundo de cache

/**
 * Valida se usuário está autenticado e tem acesso à rota
 * Se não estiver logado, redireciona para /login
 * Se não tiver acesso, redireciona para /access-denied
 */
export async function validateServerAuth(pathname: string): Promise<void> {
  // 1. Ignora rotas públicas
  if (PUBLIC_ROUTES.includes(pathname)) {
    return;
  }

  // 2. Verifica se está logado
  const accessToken = await getServerAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  // 3. Rotas que só precisam de autenticação (não verificam permissão específica)
  if (AUTH_ONLY_ROUTES.includes(pathname)) {
    return;
  }

  // 4. Verifica cache
  const cacheKey = `${accessToken}:${pathname}`;
  const cached = routeAccessCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    if (!cached.hasAccess) {
      redirect('/redirect');
    }
    return;
  }

  // 5. Verifica se tem acesso à rota na API
  let hasAccess = false;
  try {
    const response = await getUserRouteAccessByPath(pathname);
    hasAccess = response.data === true;
    
    // Atualiza cache
    routeAccessCache.set(cacheKey, { hasAccess, timestamp: now });
    
    // Limpa cache antigo (mantém apenas últimas 100 entradas)
    if (routeAccessCache.size > 100) {
      const entries = Array.from(routeAccessCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, 50).forEach(([key]) => routeAccessCache.delete(key));
    }
  } catch (error) {
    console.error('Error validating route access:', error);
    // Em caso de erro na API, permite acesso para não quebrar a aplicação
    // mas você pode mudar esse comportamento conforme necessário
    return;
  }
  
  // 6. Redireciona se não tiver acesso (FORA do try/catch para não capturar NEXT_REDIRECT)
  if (!hasAccess) {
    redirect('/redirect');
  }
}

/**
 * Verifica se usuário está autenticado (sem redirect)
 */
export async function isServerAuthenticated(): Promise<boolean> {
  const accessToken = await getServerAccessToken();
  return !!accessToken;
}

/**
 * Valida se usuário tem acesso à rota no contexto especificado
 * @param pathname - Caminho da rota a ser validada
 * @param context - Contexto da rota ('admin' | 'client')
 * @returns Promise<{ user: AuthUser; hasAccess: boolean }>
 */
export async function validateRouteAccess(
  pathname: string,
  context: RouteContext
): Promise<{ user: AuthUser; hasAccess: boolean }> {
  // 1. Verifica se está autenticado
  const accessToken = await getServerAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  // 2. Obtém dados do usuário
  let user: AuthUser;
  try {
    const userResponse = await getCurrentUser();
    if (!userResponse.data) {
      redirect('/login');
    }
    user = userResponse.data;
  } catch (error) {
    console.error('Error getting current user:', error);
    redirect('/login');
  }

  // 3. Valida contexto específico
  if (context === 'client') {
    // Cliente precisa ter companyId
    if (!user.companyId) {
      return { user, hasAccess: false };
    }
  }

  // 4. Verifica permissão de acesso na API (a API já valida o contexto correto)
  let hasAccess = false;
  try {
    const response = await getUserRouteAccessByPath(pathname);
    hasAccess = response.data === true;
  } catch (error) {
    console.error('Error validating route access:', error);
    hasAccess = false;
  }

  return { user, hasAccess };
}
