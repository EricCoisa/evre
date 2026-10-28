import { NextResponse } from 'next/server';
import axios from 'axios';
import { getServerAccessToken, getServerLang } from '@/lib/actions/auth/server-auth';
import { clientIpHeader } from '@/lib/api/client-ip';
import { API_PATHS } from '@/lib/generated/paths';

/** Faz login no Payload CMS usando credenciais obtidas do backend. */
export async function POST() {
  try {
    const accessToken = await getServerAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Obtém credenciais do backend (verifica acesso e garante PayloadUser)
    const credentialsResponse = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}${API_PATHS.CMS_CREDENTIALS}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(await clientIpHeader()),
          'Accept-Language': (await getServerLang()) ?? 'pt-BR',
        },
        withCredentials: true,
      },
    );

    const { email, password } = credentialsResponse.data;

    // Faz login direto no Payload CMS para obter token válido
    const payloadLoginResponse = await axios.post(
      `${process.env.NEXTAUTH_URL}/api/users/login`,
      { email, password },
      { withCredentials: true },
    );

    const { token, user } = payloadLoginResponse.data;

    // Cria resposta para o frontend
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        collection: 'users',
      },
      message: 'Login successful',
    });

    // Define o cookie 'payload-token' com o token gerado pelo Payload
    response.cookies.set('payload-token', token, {
      httpOnly: true,
      // Mesmo padrão de access_token/refresh_token (server-auth.ts). Browsers tratam
      // http://localhost como origem segura, então `true` não atrapalha o dev local.
      secure: true,
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutos — em segundos, como o resto dos cookies
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('CMS Login error:', error);
    let message = 'Login failed';
    if (axios.isAxiosError(error)) {
      console.error('Login error response:', error.response?.data);
      message = error.response?.data?.message || message;
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ message }, { status: 401 });
  }
}

