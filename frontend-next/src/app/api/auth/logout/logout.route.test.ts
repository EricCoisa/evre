import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => {
  const post = vi.fn();
  return {
    default: { post, create: vi.fn(() => ({ post })) },
    isAxiosError: vi.fn(),
  };
});

// server-auth uses next/headers; stub only the functions used by logout route
vi.mock('@/lib/actions/auth/server-auth', () => ({
  getServerAccessToken: vi.fn(),
  getServerRefreshToken: vi.fn(),
  getServerLang: vi.fn().mockResolvedValue(undefined),
  deleteServerAccessToken: vi.fn(),
  deleteServerRefreshToken: vi.fn(),
}));

import axios from 'axios';
import * as serverAuth from '@/lib/actions/auth/server-auth';
import { POST } from './route';

const mockedPost = vi.mocked(axios.post);
const getAccessToken = vi.mocked(serverAuth.getServerAccessToken);
const getRefreshToken = vi.mocked(serverAuth.getServerRefreshToken);
const deleteAccess = vi.mocked(serverAuth.deleteServerAccessToken);
const deleteRefresh = vi.mocked(serverAuth.deleteServerRefreshToken);

beforeEach(() => {
  vi.clearAllMocks();
});

// A rota de logout lê tudo de cookies (server-auth), então POST() não recebe request.

describe('POST /api/auth/logout', () => {
  it('calls backend logout and returns success when tokens present', async () => {
    getAccessToken.mockResolvedValue('access-tok');
    getRefreshToken.mockResolvedValue('refresh-tok');
    mockedPost.mockResolvedValue({
      data: { message: 'logged out' },
      headers: {},
    });

    const res = await POST();
    const body = await res.json();

    expect(mockedPost).toHaveBeenCalledOnce();
    expect(body.success).toBe(true);
  });

  it('clears cookies via server-auth when no tokens present', async () => {
    getAccessToken.mockResolvedValue(undefined);
    getRefreshToken.mockResolvedValue(undefined);

    const res = await POST();
    const body = await res.json();

    // backend not called, fallback cookie deletion runs
    expect(mockedPost).not.toHaveBeenCalled();
    expect(deleteAccess).toHaveBeenCalledOnce();
    expect(deleteRefresh).toHaveBeenCalledOnce();
    expect(body.success).toBe(true);
  });

  it('falls back to local cookie delete when backend call fails', async () => {
    getAccessToken.mockResolvedValue('access-tok');
    getRefreshToken.mockResolvedValue('refresh-tok');
    mockedPost.mockRejectedValue(new Error('backend down'));

    const res = await POST();
    const body = await res.json();

    // Error swallowed; fallback path runs
    expect(deleteAccess).toHaveBeenCalledOnce();
    expect(deleteRefresh).toHaveBeenCalledOnce();
    expect(body.success).toBe(true);
  });
});
