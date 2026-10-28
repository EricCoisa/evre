import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must mock next/headers before importing server-auth
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockHas = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
    has: mockHas,
  })),
}));

// server-auth calls redirect from next/navigation on failure; stub it to throw
// (redirect in Next throws internally; our tests won't hit those paths)
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
}));

// validateRouteAccess depends on these; mock them here
vi.mock('@/lib/actions/auth/api', () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock('@/lib/actions/access/userRoute/api', () => ({
  getUserRouteAccessByPath: vi.fn(),
}));

import {
  getServerAccessToken,
  setServerAccessToken,
  setServerRefreshToken,
  getServerRefreshToken,
  deleteServerAccessToken,
  deleteServerRefreshToken,
  getAuthHeaders,
  getServerLang,
  isServerAuthenticated,
  validateRouteAccess,
} from './server-auth';
import * as authApi from '@/lib/actions/auth/api';
import * as userRouteApi from '@/lib/actions/access/userRoute/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getServerAccessToken', () => {
  it('returns cookie value when present', async () => {
    mockGet.mockReturnValue({ value: 'my-token' });
    const result = await getServerAccessToken();
    expect(result).toBe('my-token');
    expect(mockGet).toHaveBeenCalledWith('access_token');
  });

  it('returns undefined when cookie absent', async () => {
    mockGet.mockReturnValue(undefined);
    const result = await getServerAccessToken();
    expect(result).toBeUndefined();
  });
});

describe('setServerAccessToken', () => {
  it('sets cookie with httpOnly, secure, sameSite options', async () => {
    await setServerAccessToken('new-token');
    expect(mockSet).toHaveBeenCalledWith(
      'access_token',
      'new-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      }),
    );
  });
});

describe('setServerRefreshToken', () => {
  it('sets cookie with httpOnly, secure, sameSite options', async () => {
    await setServerRefreshToken('refresh-token');
    expect(mockSet).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      }),
    );
  });
});

describe('getServerRefreshToken', () => {
  it('returns cookie value when present', async () => {
    mockGet.mockReturnValue({ value: 'refresh-value' });
    expect(await getServerRefreshToken()).toBe('refresh-value');
    expect(mockGet).toHaveBeenCalledWith('refresh_token');
  });

  it('returns undefined when cookie absent', async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getServerRefreshToken()).toBeUndefined();
  });
});

describe('deleteServerAccessToken', () => {
  it('deletes the access_token cookie', async () => {
    await deleteServerAccessToken();
    expect(mockDelete).toHaveBeenCalledWith('access_token');
  });
});

describe('deleteServerRefreshToken', () => {
  it('deletes the refresh_token cookie', async () => {
    await deleteServerRefreshToken();
    expect(mockDelete).toHaveBeenCalledWith('refresh_token');
  });
});

describe('getAuthHeaders', () => {
  it('returns Authorization header when access token present', async () => {
    mockGet.mockReturnValue({ value: 'my-token' });
    expect(await getAuthHeaders()).toEqual({ Authorization: 'Bearer my-token' });
  });

  it('returns null when no access token', async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getAuthHeaders()).toBeNull();
  });
});

describe('getServerLang', () => {
  it('returns the i18nextLng cookie value', async () => {
    mockGet.mockReturnValue({ value: 'pt-BR' });
    expect(await getServerLang()).toBe('pt-BR');
    expect(mockGet).toHaveBeenCalledWith('i18nextLng');
  });
});

describe('isServerAuthenticated', () => {
  it('returns true when access_token cookie exists', async () => {
    mockGet.mockReturnValue({ value: 'tok' });
    expect(await isServerAuthenticated()).toBe(true);
  });

  it('returns false when cookie absent', async () => {
    mockGet.mockReturnValue(undefined);
    expect(await isServerAuthenticated()).toBe(false);
  });
});

describe('validateRouteAccess', () => {
  const mockUser = { id: '1', email: 'a@b.com', name: 'Alice' };

  it('returns { user, hasAccess: true } when backend confirms access', async () => {
    mockGet.mockReturnValue({ value: 'token' });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      success: true, data: mockUser as any, message: '', status: 200,
    });
    vi.mocked(userRouteApi.getUserRouteAccessByPath).mockResolvedValue({
      success: true, data: true, message: '', status: 200,
    });

    const result = await validateRouteAccess('/dashboard', 'client');

    expect(result.user).toEqual(mockUser);
    expect(result.hasAccess).toBe(true);
  });

  it('returns { user, hasAccess: false } when backend denies access', async () => {
    mockGet.mockReturnValue({ value: 'token' });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      success: true, data: mockUser as any, message: '', status: 200,
    });
    vi.mocked(userRouteApi.getUserRouteAccessByPath).mockResolvedValue({
      success: false, data: false, message: 'forbidden', status: 403,
    });

    const result = await validateRouteAccess('/restricted', 'client');

    expect(result.hasAccess).toBe(false);
  });

  it('redirects to /login when not authenticated', async () => {
    mockGet.mockReturnValue(undefined);

    await expect(validateRouteAccess('/dashboard', 'client')).rejects.toThrow('redirect:/login');
  });

  it('redirects to /login when getCurrentUser resolves without data', async () => {
    mockGet.mockReturnValue({ value: 'token' });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      success: false, data: null, message: 'erro', status: 500,
    });

    await expect(validateRouteAccess('/dashboard', 'client')).rejects.toThrow('redirect:/login');
  });

  it('redirects to /login when getCurrentUser throws', async () => {
    mockGet.mockReturnValue({ value: 'token' });
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('network error'));

    await expect(validateRouteAccess('/dashboard', 'client')).rejects.toThrow('redirect:/login');
  });

  it('returns hasAccess: false when getUserRouteAccessByPath throws', async () => {
    mockGet.mockReturnValue({ value: 'token' });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      success: true, data: mockUser as any, message: '', status: 200,
    });
    vi.mocked(userRouteApi.getUserRouteAccessByPath).mockRejectedValue(new Error('network error'));

    const result = await validateRouteAccess('/dashboard', 'client');

    expect(result.hasAccess).toBe(false);
  });
});
