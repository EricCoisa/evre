import axios from "axios";
import { NextResponse, type NextRequest } from "next/server";
import { CAPTCHA_TOKEN_HEADER } from "@/lib/api/captcha-header";
import { clientIpHeader } from "@/lib/api/client-ip";
import { getServerLang } from "@/lib/actions/auth/server-auth";
import { API_PATHS } from "@/lib/generated/paths";

const ACCESS_TOKEN_COOKIE =
  process.env.ACCESS_TOKEN_COOKIE_NAME || "access_token";

import { forwardSetCookies } from "@/lib/api/cookie-forward";

function extractInviteError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    const message = error.response?.data?.message ?? "invite_acceptance_failed";
    return { status, message };
  }
  return { status: 500, message: "invite_acceptance_failed" };
}

export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid_request" }, { status: 400 });
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!body.token || !accessToken) {
    return NextResponse.json({ message: "invalid_request" }, { status: 400 });
  }

  const captchaToken = request.headers.get(CAPTCHA_TOKEN_HEADER);

  try {
    const backendResponse = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}${API_PATHS.AUTH_ACCEPT_INVITE}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(await clientIpHeader()),
          ...(captchaToken ? { [CAPTCHA_TOKEN_HEADER]: captchaToken } : {}),
          "Accept-Language": (await getServerLang()) ?? "pt-BR",
        },
      },
    );

    const response = NextResponse.json(backendResponse.data);
    forwardSetCookies(response, backendResponse.headers["set-cookie"]);
    return response;
  } catch (error) {
    const { status, message } = extractInviteError(error);
    console.error("Invite acceptance failed", { status });
    return NextResponse.json({ message }, { status });
  }
}
