export const OAUTH_SIGNUP_COOKIE = "oauth_signup_token";

export const OAUTH_SIGNUP_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/api/auth/oauth/signup/complete",
} as const;

export const OAUTH_SIGNUP_COOKIE_MAX_AGE = 10 * 60;
