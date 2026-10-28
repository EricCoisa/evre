import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';

const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const mockLoginClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/auth/auth-action', () => ({
  loginClient: mockLoginClient,
}));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

async function fillAndSubmit() {
  await userEvent.type(screen.getByPlaceholderText('emailPlaceholder'), 'a@b.com');
  await userEvent.type(screen.getByPlaceholderText('••••••'), 'secret1');
  await userEvent.click(screen.getByRole('button', { name: 'common:login' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginForm', () => {
  it('declara method="post" — Enter antes da hidratação não deve virar GET com credenciais na URL', () => {
    const { container } = render(<LoginForm />);
    expect(container.querySelector('form')).toHaveAttribute('method', 'post');
  });

  it('login bem-sucedido navega para a callbackUrl segura', async () => {
    mockLoginClient.mockResolvedValue({ user: { routes: [] } });
    render(<LoginForm callbackUrl="/after-login" />);

    await fillAndSubmit();

    await waitFor(() => expect(mockLoginClient).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith('/after-login');
  });

  it('ignora callbackUrl não-relativa (open redirect)', async () => {
    mockLoginClient.mockResolvedValue({ user: { routes: [] } });
    render(<LoginForm callbackUrl="https://evil.com" />);

    await fillAndSubmit();

    await waitFor(() => expect(mockLoginClient).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('bloqueia o submit e mostra erro quando captcha habilitado não devolve token', async () => {
    const captchaControl = { getToken: vi.fn().mockResolvedValue(null), enabled: true };
    render(<LoginForm captchaControl={captchaControl} />);

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText('common:captchaRequired')).toBeInTheDocument());
    expect(mockLoginClient).not.toHaveBeenCalled();
  });

  it('mostra a mensagem de erro do loginClient quando ele rejeita com Error', async () => {
    mockLoginClient.mockRejectedValue(new Error('Credenciais inválidas'));
    render(<LoginForm />);

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument());
  });

  it('cai no erro genérico quando a rejeição não é um Error com mensagem', async () => {
    mockLoginClient.mockRejectedValue('falhou');
    render(<LoginForm />);

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText('common:errorMessage')).toBeInTheDocument());
  });
});
