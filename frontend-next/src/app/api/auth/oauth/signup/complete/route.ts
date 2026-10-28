import { NextResponse, type NextRequest } from 'next/server';
import axios from 'axios';
import { CAPTCHA_TOKEN_HEADER } from '@/lib/api/captcha-header';
import { clientIpHeader } from '@/lib/api/client-ip';
import { getServerLang } from '@/lib/actions/auth/server-auth';
import { API_PATHS } from '@/lib/generated/paths';
import {
  OAUTH_SIGNUP_COOKIE,
  OAUTH_SIGNUP_COOKIE_OPTIONS,
} from '@/lib/oauth-signup-cookie';

import { forwardSetCookies } from '@/lib/api/cookie-forward';

function clearSignupToken(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_SIGNUP_COOKIE, '', {
    ...OAUTH_SIGNUP_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

function badRequestResponse(): NextResponse {
  return clearSignupToken(
    NextResponse.json({ error: 'invalid_request' }, { status: 400 }),
  );
}

function errorResponse(error: unknown): NextResponse {
  const status = axios.isAxiosError(error) ? error.response?.status ?? 400 : 400;
  return clearSignupToken(
    NextResponse.json({ error: 'oauth_signup_failed' }, { status }),
  );
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(OAUTH_SIGNUP_COOKIE)?.value;
  let body: { acceptTerms?: boolean };
  try {
    body = await request.json();
  } catch {
    return badRequestResponse();
  }
  if (!token || body.acceptTerms !== true) {
    return badRequestResponse();
  }

  const captchaToken = request.headers.get(CAPTCHA_TOKEN_HEADER);

  try {
    const backendResponse = await axios.post<{
      callbackUrl?: string;
      user: { id: string; email: string; roleId: string | null };
    }>(
      `${process.env.NEXT_PUBLIC_API_URL}${API_PATHS.AUTH_OAUTH_SIGNUP_COMPLETE}`,
      { token, acceptTerms: body.acceptTerms },
      {
        headers: {
          ...(await clientIpHeader()),
          ...(captchaToken ? { [CAPTCHA_TOKEN_HEADER]: captchaToken } : {}),
          'Accept-Language': (await getServerLang()) ?? 'pt-BR',
        },
      },
    );
    const response = NextResponse.json(backendResponse.data);
    clearSignupToken(response);
    forwardSetCookies(response, backendResponse.headers['set-cookie']);
    return response;
  } catch (error) {
    console.error(
      'OAuth signup completion failed',
      axios.isAxiosError(error) ? error.response?.status : 'request error',
    );
    return errorResponse(error);
  }
}
