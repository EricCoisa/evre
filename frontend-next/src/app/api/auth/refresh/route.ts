import { NextResponse } from 'next/server';
import { getServerRefreshToken } from '@/lib/actions/auth/server-auth';
import { clientIpHeader } from '@/lib/api/client-ip';
import { refreshSession } from '@/lib/api/session-refresh';

/** Renova a sessão no backend e repassa os cookies ao cliente. */
export async function POST() {
  const refreshToken = await getServerRefreshToken();
  if (!refreshToken) {
    return NextResponse.json({ message: 'Refresh token not found' }, { status: 401 });
  }

  const refreshed = await refreshSession(refreshToken, await clientIpHeader());
  if (!refreshed) {
    return NextResponse.json({ message: 'Token refresh failed' }, { status: 401 });
  }

  const response = NextResponse.json({ message: 'refreshed' });
  for (const cookie of refreshed.setCookies) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
}