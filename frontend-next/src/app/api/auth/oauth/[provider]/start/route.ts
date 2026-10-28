import { NextResponse, type NextRequest } from "next/server";
import axios from "axios";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_OPTIONS,
  OAUTH_STATE_MAX_AGE,
} from "@/lib/oauth-state-cookie";
import { getServerLang } from "@/lib/actions/auth/server-auth";
import { clientIpHeader } from "@/lib/api/client-ip";
import { CAPTCHA_TOKEN_HEADER } from "@/lib/api/captcha-header";
import { API_PATHS } from "@/lib/generated/paths";

function getOAuthIntent(body: {
  intent?: "LOGIN" | "SIGNUP" | "INVITE";
  inviteToken?: string;
}): "LOGIN" | "SIGNUP" | "INVITE" {
  if (body.intent) return body.intent;
  return body.inviteToken ? "INVITE" : "LOGIN";
}

function getErrorStatus(error: unknown): number {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? 400;
  }
  return 400;
}

/** Starts OAuth only after the backend validates the submitting browser's CAPTCHA. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const body: {
    callbackUrl?: string;
    inviteToken?: string;
    intent?: "LOGIN" | "SIGNUP" | "INVITE";
  } = await request.json();
  const captchaToken = request.headers.get(CAPTCHA_TOKEN_HEADER);

  try {
    const { data } = await axios.post<{ url: string }>(
      `${process.env.NEXT_PUBLIC_API_URL}${API_PATHS.AUTH_OAUTH_BY_PROVIDER_AUTHORIZE_URL(provider)}`,
      {
        ...body,
        intent: getOAuthIntent(body),
      },
      {
        headers: {
          ...(await clientIpHeader()),
          ...(captchaToken ? { [CAPTCHA_TOKEN_HEADER]: captchaToken } : {}),
          "Accept-Language": (await getServerLang()) ?? "pt-BR",
        },
      },
    );

    const state = new URL(data.url).searchParams.get("state");
    if (!state) throw new Error("OAuth state missing from authorization URL");

    const response = NextResponse.json({ url: data.url });
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      ...OAUTH_STATE_COOKIE_OPTIONS,
      maxAge: OAUTH_STATE_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error(
      "OAuth start failed",
      axios.isAxiosError(error) ? error.response?.status : "request error",
    );
    return NextResponse.json(
      { error: "oauth_start_failed" },
      { status: getErrorStatus(error) },
    );
  }
}
