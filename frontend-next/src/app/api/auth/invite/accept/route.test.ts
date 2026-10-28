import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/auth/server-auth", () => ({
  getServerLang: vi.fn().mockResolvedValue("pt-BR"),
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

const mockedPost = vi.mocked(axios.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/invite/accept", () => {
  it("forwards the access token and updated-session cookie", async () => {
    mockedPost.mockResolvedValue({
      data: { created: "user_updated" },
      headers: { "set-cookie": ["access_token=refreshed; HttpOnly"] },
    });
    const request = new NextRequest(
      "http://localhost/api/auth/invite/accept",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "invite-token" }),
      },
    );
    request.cookies.set("access_token", "current-access");

    const response = await POST(request);

    expect(mockedPost).toHaveBeenCalledWith(
      expect.stringContaining("/auth/accept-invite"),
      { token: "invite-token" },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer current-access",
        }),
      }),
    );
    expect(response.headers.getSetCookie?.()).toContain(
      "access_token=refreshed; HttpOnly",
    );
  });
});
