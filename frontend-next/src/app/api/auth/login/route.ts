import { NextResponse } from 'next/server';
import axios from 'axios';
import { getServerLang } from '@/lib/actions/auth/server-auth';
import { clientIpHeader } from '@/lib/api/client-ip';
import { CAPTCHA_TOKEN_HEADER, captchaHeader } from '@/lib/api/captcha-header';
import { API_PATHS } from '@/lib/generated/paths';

import { forwardSetCookies } from '@/lib/api/cookie-forward';

function getLoginErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    console.error('Login error response:', error.response?.data);
    return error.response?.data?.message ?? '';
  }
  console.error('Login error:', error);
  return '';
}

/** Faz login no backend e repassa os cookies HttpOnly ao browser. */
export async function POST(request: Request) {
  const body = await request.json();
  const captchaToken = request.headers.get(CAPTCHA_TOKEN_HEADER);

  try {
    const backendResponse = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}${API_PATHS.AUTH_LOGIN}`,
      body,
      {
        withCredentials: true,
        headers: {
          ...(await clientIpHeader()),
          ...captchaHeader(captchaToken),
          'Accept-Language': (await getServerLang()) ?? 'pt-BR',
        },
      }
    );

    const response = NextResponse.json({ user: backendResponse.data.user });
    forwardSetCookies(response, backendResponse.headers['set-cookie']);
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: getLoginErrorMessage(error) },
      { status: 401 }
    );
  }
}

