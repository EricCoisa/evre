import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * API Route para refresh de token
 * Lê o refresh_token do cookie, chama o backend e repassa cookies e resposta
 */
export async function POST(request: Request) {
  // Extrai cookies do request
  const cookieHeader = request.headers.get('cookie') || '';
  let refreshToken = '';
  // Busca refresh_token no cookie
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === 'refresh_token') {
      refreshToken = rest.join('=');
      break;
    }
  }

  if (!refreshToken) {
    return NextResponse.json({ error: 'Refresh token not found' }, { status: 401 });
  }

  try {
    // Chama endpoint de refresh do backend
    const backendResponse = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
      {},
      {
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
        withCredentials: true,
      }
    );

    // Extrai cookies setados pelo backend
    const setCookie = backendResponse.headers['set-cookie'];
    const message = backendResponse.data?.message;

    // Cria resposta para o frontend
    const response = NextResponse.json({ message });
    // Repassa os cookies do backend para o cliente
    if (setCookie) {
      // Pode ser string ou array
      if (Array.isArray(setCookie)) {
        for (const cookie of setCookie) {
          response.headers.append('set-cookie', cookie);
        }
      } else {
        response.headers.set('set-cookie', setCookie);
      }
    }
    return response;
  } catch (error) {
    let message = 'Token refresh failed';
    if (axios.isAxiosError(error)) {
      message = error.response?.data?.message || message;
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}