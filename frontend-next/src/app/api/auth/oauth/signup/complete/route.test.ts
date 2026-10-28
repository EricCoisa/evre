import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/auth/server-auth", () => ({
  getServerLang: vi.fn().mockResolvedValue("en"),
}));

vi.mock("axios", () => {
  const post = vi.fn();
  const isAxiosError = vi.fn(() => false);
  return {
    default: { post, isAxiosError },
    isAxiosError,
  };
});

import axios from "axios";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { OAUTH_SIGNUP_COOKIE } from "@/lib/oauth-signup-cookie";

const mockedPost = vi.mocked(axios.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/oauth/signup/complete", () => {
  it("takes the one-time token from the HttpOnly cookie and clears it", async () => {
    mockedPost.mockResolvedValue({
      data: { user: { id: "user-1" } },
      headers: { "set-cookie": ["access_token=access; HttpOnly"] },
    });
    const request = new NextRequest(
      "http://localhost/api/auth/oauth/signup/complete",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acceptTerms: true }),
      },
    );
    request.cookies.set(OAUTH_SIGNUP_COOKIE, "intent.secret");

    const response = await POST(request);

    expect(mockedPost).toHaveBeenCalledWith(
      expect.any(String),
      { token: "intent.secret", acceptTerms: true },
      expect.any(Object),
    );
    expect(response.headers.getSetCookie?.()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^access_token=access/),
        expect.stringMatching(/^oauth_signup_token=;.*Max-Age=0/),
      ]),
    );
  });
});
