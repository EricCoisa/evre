"use server"

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserRouteAccessByPath } from '../access/userRoute/api';
import { getCurrentUser } from './api';
import type { AuthUser } from './types';

type RouteContext = 'admin' | 'client';

const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token';
/** Salva o access_token no cookie HttpOnly. */
export async function setServerAccessToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60, // 15 minutos em segundos
  });
}

/** Salva o refresh_token no cookie HttpOnly. */
export async function setServerRefreshToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 dias em segundos
  });
}

/** Obtém o refresh_token do cookie. */
export async function getServerRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
}

/** Remove o access_token do cookie. */
export async function deleteServerAccessToken() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
}

/** Remove o refresh_token do cookie. */
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


/** Obtém o access_token do cookie. */
export async function getServerAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getServerLang(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("i18nextLng")?.value;
}

/** Indica se há sessão, sem redirecionar. */
export async function isServerAuthenticated(): Promise<boolean> {
  const accessToken = await getServerAccessToken();
  return !!accessToken;
}

/** Valida se o usuário tem acesso à rota no contexto especificado. */
export async function validateRouteAccess(
  pathname: string,
  _context: RouteContext
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
  // if (context === 'client') {

  // }

  let hasAccess = false;
  
  try {
    const response = await getUserRouteAccessByPath(pathname);
    // Verifica se a requisição foi bem-sucedida E se o usuário tem acesso
    if (!response.success) {
      hasAccess = false;
    } else {
      hasAccess = response.data === true;
    }
  } catch {
    hasAccess = false;
  }
  return { user, hasAccess };
}
