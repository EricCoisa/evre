import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from './user-menu';

const mockPush = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

const mockUseMe = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/auth/queries', () => ({ useMe: mockUseMe }));

const mockUsePresignedUrl = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/storage/queries', () => ({ usePresignedUrl: mockUsePresignedUrl }));

const mockLogout = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/auth/auth-action', () => ({ logout: mockLogout }));

const mockSetDevTools = vi.hoisted(() => vi.fn());
const mockUseApp = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/appProvider', () => ({ useApp: mockUseApp }));

const mockIsDevelopment = vi.hoisted(() => vi.fn());
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return { ...actual, isDevelopment: mockIsDevelopment };
});

vi.mock('./ui/languageToggle', () => ({ LanguageToggle: () => <div>lang-toggle</div> }));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMe.mockReturnValue({ data: { name: 'Alice', email: 'alice@x.com', image: 'key.png' } });
  mockUsePresignedUrl.mockReturnValue({ data: { url: 'https://cdn/key.png' } });
  mockUseApp.mockReturnValue({ devTools: false, setDevTools: mockSetDevTools });
  mockIsDevelopment.mockReturnValue(false);
});

describe('UserMenu', () => {
  it('mostra a inicial do nome no fallback do avatar', () => {
    mockUseMe.mockReturnValue({ data: undefined });
    mockUsePresignedUrl.mockReturnValue({ data: undefined });
    render(<UserMenu />);

    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('abre o menu e mostra nome, email e opções', async () => {
    render(<UserMenu />);

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@x.com')).toBeInTheDocument();
    expect(screen.getByText('profile')).toBeInTheDocument();
    expect(screen.getByText('logout')).toBeInTheDocument();
  });

  it('clica em profile e navega para /profile', async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button'));

    await userEvent.click(screen.getByText('profile'));

    expect(mockPush).toHaveBeenCalledWith('/profile');
  });

  it('clica em logout e chama a action de logout', async () => {
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button'));

    await userEvent.click(screen.getByText('logout'));

    expect(mockLogout).toHaveBeenCalled();
  });

  it('não explode quando logout lança erro', async () => {
    mockLogout.mockImplementation(() => { throw new Error('boom'); });
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button'));

    await userEvent.click(screen.getByText('logout'));

    expect(mockLogout).toHaveBeenCalled();
  });

  it('sem fallback de nome, usa o email de qualquer forma', async () => {
    mockUseMe.mockReturnValue({ data: { email: 'bob@x.com' } });
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('bob@x.com')).toBeInTheDocument();
  });

  it('mostra o item DevTools em desenvolvimento e alterna via switch', async () => {
    mockIsDevelopment.mockReturnValue(true);
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('DevTools')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'DevTools' }));

    expect(mockSetDevTools).toHaveBeenCalledWith(true);
  });

  it('esconde o item DevTools fora de desenvolvimento', async () => {
    mockIsDevelopment.mockReturnValue(false);
    render(<UserMenu />);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.queryByText('DevTools')).not.toBeInTheDocument();
  });
});
