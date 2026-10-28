import { describe, it, expect, vi } from 'vitest';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetMe = vi.hoisted(() => vi.fn());
const mockForgotPassword = vi.hoisted(() => vi.fn());
const mockResetPassword = vi.hoisted(() => vi.fn());
const mockCheckResetToken = vi.hoisted(() => vi.fn());
const mockOauthProviders = vi.hoisted(() => vi.fn());
const mockSaveOauthConfig = vi.hoisted(() => vi.fn());
vi.mock('@/lib/generated/auth/auth', () => ({
  getAuth: () => ({
    authControllerGetUser: mockGetUser,
    authControllerGetMe: mockGetMe,
    authControllerForgotPassword: mockForgotPassword,
    authControllerResetPassword: mockResetPassword,
    authControllerCheckResetToken: mockCheckResetToken,
    authControllerOauthProviders: mockOauthProviders,
    authControllerSaveOauthConfig: mockSaveOauthConfig,
  }),
}));
const mockCaptchaHeader = vi.hoisted(() => vi.fn());
vi.mock('../../api/captcha-header', () => ({ captchaHeader: mockCaptchaHeader }));

import {
  getProfile,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  checkResetToken,
  getOAuthProviders,
  saveOAuthConfig,
} from './api';

describe('getProfile', () => {
  it('backend fora do ar: devolve o erro sem explodir ao tocar em .data', async () => {
    mockGetUser.mockRejectedValue(new Error('Erro de conexão com o servidor'));

    const result = await getProfile();

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it('sucesso: deriva image a partir de imageUrl', async () => {
    mockGetUser.mockResolvedValue({ imageUrl: 'https://x/img.png' });

    const result = await getProfile();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ image: 'https://x/img.png' });
  });
});

describe('getCurrentUser', () => {
  it('devolve o usuário autenticado', async () => {
    mockGetMe.mockResolvedValue({ id: '1', email: 'a@b.com' });

    const result = await getCurrentUser();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: '1', email: 'a@b.com' });
  });
});

describe('forgotPassword', () => {
  it('envia o captchaToken no header', async () => {
    mockForgotPassword.mockResolvedValue(true);
    mockCaptchaHeader.mockReturnValue({ 'x-captcha-token': 'tok' });

    const result = await forgotPassword({ email: 'a@b.com' }, 'tok');

    expect(result.success).toBe(true);
    expect(mockCaptchaHeader).toHaveBeenCalledWith('tok');
    expect(mockForgotPassword).toHaveBeenCalledWith(
      { email: 'a@b.com' },
      { headers: { 'x-captcha-token': 'tok' } },
    );
  });
});

describe('resetPassword', () => {
  it('encaminha token e nova senha', async () => {
    mockResetPassword.mockResolvedValue({ message: 'ok' });
    mockCaptchaHeader.mockReturnValue({});

    const result = await resetPassword({ token: 'tok', password: 'new-pass' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ message: 'ok' });
    expect(mockResetPassword).toHaveBeenCalledWith(
      { token: 'tok', password: 'new-pass' },
      { headers: {} },
    );
  });
});

describe('checkResetToken', () => {
  it('devolve se o token é válido', async () => {
    mockCheckResetToken.mockResolvedValue({ valid: true });

    const result = await checkResetToken('tok');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ valid: true });
    expect(mockCheckResetToken).toHaveBeenCalledWith({ token: 'tok' });
  });
});

describe('getOAuthProviders', () => {
  it('lista os providers OAuth registrados', async () => {
    mockOauthProviders.mockResolvedValue([{ id: 'google', label: 'Google', configured: true, enabled: true }]);

    const result = await getOAuthProviders();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 'google', label: 'Google', configured: true, enabled: true }]);
  });

  it('propaga o erro quando a feature está desligada (404)', async () => {
    mockOauthProviders.mockRejectedValue({ response: { status: 404, data: { message: 'Not Found' } } });

    const result = await getOAuthProviders();

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
  });
});

describe('saveOAuthConfig', () => {
  it('grava a config de um provider', async () => {
    mockSaveOauthConfig.mockResolvedValue({ status: true, data: 'saved' });

    const result = await saveOAuthConfig('google', { issuer: 'https://x', clientId: 'id' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: true, data: 'saved' });
    expect(mockSaveOauthConfig).toHaveBeenCalledWith('google', { issuer: 'https://x', clientId: 'id' });
  });
});
