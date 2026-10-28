import { NextResponse, type NextRequest } from "next/server";
import axios from "axios";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_OPTIONS,
} from "@/lib/oauth-state-cookie";
import {
  OAUTH_SIGNUP_COOKIE,
  OAUTH_SIGNUP_COOKIE_MAX_AGE,
  OAUTH_SIGNUP_COOKIE_OPTIONS,
} from "@/lib/oauth-signup-cookie";
import { getServerLang } from "@/lib/actions/auth/server-auth";
import { clientIpHeader } from "@/lib/api/client-ip";
import { API_PATHS } from "@/lib/generated/paths";

import { forwardSetCookies } from "@/lib/api/cookie-forward";

interface OAuthCallbackData {
  callbackUrl?: string;
  consentRequired?: boolean;
  signupIntent?: "SIGNUP" | "INVITE";
  signupToken?: string;
  providerId?: string;
}

function clearStateCookie(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    ...OAUTH_STATE_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

function handleConsent(
  data: OAuthCallbackData,
  request: NextRequest,
): NextResponse | null {
  if (!data.consentRequired || !data.signupToken || !data.providerId || !data.signupIntent) {
    return null;
  }
  const target = request.nextUrl.clone();
  target.pathname = "/signup";
  target.search = new URLSearchParams({
    provider: data.providerId,
    signupIntent: data.signupIntent,
  }).toString();
  const response = clearStateCookie(NextResponse.redirect(target));
  response.cookies.set(OAUTH_SIGNUP_COOKIE, data.signupToken, {
    ...OAUTH_SIGNUP_COOKIE_OPTIONS,
    maxAge: OAUTH_SIGNUP_COOKIE_MAX_AGE,
  });
  return response;
}

function handleCallbackRedirect(
  data: OAuthCallbackData,
  setCookie: string | string[] | undefined,
  request: NextRequest,
): NextResponse {
  const [pathname, search] = (data.callbackUrl ?? "/redirect").split("?");
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = search ? `?${search}` : "";

  const response = clearStateCookie(NextResponse.redirect(target));
  forwardSetCookies(response, setCookie);
  return response;
}

function extractOAuthParams(request: NextRequest): { code: string; state: string } | null {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return null;
  }
  return { code, state };
}

function logOAuthError(error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  console.error("OAuth callback failed", { status });
}

/** `redirect_uri` do provider: confere o `state` contra o cookie, repassa ao backend e propaga os cookies HttpOnly. */
export async function GET(request: NextRequest) {
  const params = extractOAuthParams(request);

  const failure = request.nextUrl.clone();
  failure.pathname = "/login";
  failure.search = "?error=oauth";

  if (!params) {
    return clearStateCookie(NextResponse.redirect(failure));
  }

  try {
    const backendResponse = await axios.post<OAuthCallbackData>(
      `${process.env.NEXT_PUBLIC_API_URL}${API_PATHS.AUTH_OAUTH_CALLBACK}`,
      params,
      {
        withCredentials: true,
        headers: {
          ...(await clientIpHeader()),
          "Accept-Language": (await getServerLang()) ?? "pt-BR",
        },
      },
    );

    const consentResponse = handleConsent(backendResponse.data, request);
    if (consentResponse) return consentResponse;

    return handleCallbackRedirect(
      backendResponse.data,
      backendResponse.headers["set-cookie"],
      request,
    );
  } catch (error) {
    logOAuthError(error);
    return clearStateCookie(NextResponse.redirect(failure));
  }
}
