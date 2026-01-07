"use server"

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';


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


/**
 * Valida se usuário está autenticado no servidor
 * Se não estiver, redireciona para /login
 */
export async function validateServerAuth(): Promise<void> {
  const accessToken = await getServerAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  // Aqui você pode adicionar validação extra do token se necessário
  // Por exemplo, decodificar o JWT e verificar expiração
}

/**
 * Verifica se usuário está autenticado (sem redirect)
 */
export async function isServerAuthenticated(): Promise<boolean> {
  const accessToken = await getServerAccessToken();
  return !!accessToken;
}
