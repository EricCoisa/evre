import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthButtons } from './oauth-buttons';
import type { OAuthProvider } from '@/lib/actions/auth/types';
import type { CaptchaTokenControl } from '@/hooks/use-captcha';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

const PROVIDERS: OAuthProvider[] = [
  { id: 'google', label: 'Google', configured: true, enabled: true },
  { id: 'github', label: 'GitHub', configured: true, enabled: true },
];

function makeCaptchaControl(overrides: Partial<CaptchaTokenControl> = {}): CaptchaTokenControl {
  return { getToken: vi.fn().mockResolvedValue(null), enabled: false, ...overrides };
}

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
  Object.defineProperty(window, 'location', {
    value: { assign: vi.fn() },
    writable: true,
  });
});

describe('OAuthButtons', () => {
  it('não renderiza nada quando a lista de providers está vazia', () => {
    const { container } = render(
      <OAuthButtons providers={[]} captchaControl={makeCaptchaControl()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza um botão por provider com o label traduzido e o separador', () => {
    render(<OAuthButtons providers={PROVIDERS} captchaControl={makeCaptchaControl()} />);

    expect(screen.getByText('orContinueWith')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'continueWith:Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'continueWith:GitHub' })).toBeInTheDocument();
  });

  it('ao clicar, chama fetch com a URL/corpo certos e navega para a URL retornada', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://provider/auth' }) });
    vi.stubGlobal('fetch', fetchMock);
    const captchaControl = makeCaptchaControl();

    render(
      <OAuthButtons
        providers={PROVIDERS}
        captchaControl={captchaControl}
        callbackUrl="/after-login"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'continueWith:Google' }));

    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('https://provider/auth'));

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/oauth/google/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callbackUrl: '/after-login', intent: 'LOGIN' }),
    });
  });

  it('usa intent INVITE por padrão quando inviteToken é passado, e inclui o token no corpo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://provider/auth' }) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <OAuthButtons
        providers={PROVIDERS}
        captchaControl={makeCaptchaControl()}
        inviteToken="tok-123"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'continueWith:Google' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/oauth/google/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken: 'tok-123', intent: 'INVITE' }),
    });
  });

  it('inclui o header de captcha quando o captcha retorna um token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://provider/auth' }) });
    vi.stubGlobal('fetch', fetchMock);
    const captchaControl = makeCaptchaControl({ enabled: true, getToken: vi.fn().mockResolvedValue('cap-token') });

    render(<OAuthButtons providers={PROVIDERS} captchaControl={captchaControl} />);

    await userEvent.click(screen.getByRole('button', { name: 'continueWith:Google' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/oauth/google/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-captcha-token': 'cap-token' },
      body: JSON.stringify({ intent: 'LOGIN' }),
    });
  });

  it('bloqueia o início e avisa quando o captcha está habilitado mas não devolve token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const captchaControl = makeCaptchaControl({ enabled: true, getToken: vi.fn().mockResolvedValue(null) });

    render(<OAuthButtons providers={PROVIDERS} captchaControl={captchaControl} />);

    await userEvent.click(screen.getByRole('button', { name: 'continueWith:Google' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('common:captchaRequired'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('avisa com oauthStartFailed quando a resposta do start não é ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    render(<OAuthButtons providers={PROVIDERS} captchaControl={makeCaptchaControl()} />);

    await userEvent.click(screen.getByRole('button', { name: 'continueWith:Google' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('oauthStartFailed'));
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('ignora cliques repetidos enquanto um start já está em andamento', async () => {
    let resolveToken: (v: string | null) => void = () => {};
    const getToken = vi.fn(() => new Promise<string | null>((resolve) => { resolveToken = resolve; }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://provider/auth' }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<OAuthButtons providers={PROVIDERS} captchaControl={makeCaptchaControl({ getToken })} />);

    const button = screen.getByRole('button', { name: 'continueWith:Google' });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(getToken).toHaveBeenCalledTimes(1);

    resolveToken(null);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
