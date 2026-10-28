import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// test-setup.ts mocka este módulo globalmente (só com `refresh`) para quem o consome;
// aqui é o próprio módulo sob teste, então precisa da implementação real.
vi.unmock('@/lib/actions/auth/auth-action');

const mockPost = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/apiNext', () => ({
  APINEXT: { GET: vi.fn(), POST: mockPost, PATCH: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));

const mockRedirect = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockQueryClient = vi.hoisted(() => ({
  cancelQueries: vi.fn(),
  removeQueries: vi.fn(),
  clear: vi.fn(),
}));
vi.mock('@/lib/queryClient', () => ({
  getQueryClient: () => mockQueryClient,
}));

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { login, loginClient, refresh, logout } from './auth-action';

type Router = Parameters<typeof loginClient>[1];

function fakeRouter(): Router {
  return { push: vi.fn(), refresh: vi.fn() } as unknown as Router;
}

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posta as credenciais e repassa o header de captcha', async () => {
    mockPost.mockResolvedValue({ user: { routes: [] } });
    const credentials = { email: 'a@a.com', password: 'secret' };

    const result = await login(credentials, 'captcha-tok');

    expect(mockPost).toHaveBeenCalledWith('/auth/login', credentials, {
      headers: { 'x-captcha-token': 'captcha-tok' },
    });
    expect(result).toEqual({ user: { routes: [] } });
  });

  it('sem captcha: header fica vazio', async () => {
    mockPost.mockResolvedValue({ user: { routes: [] } });

    await login({ email: 'a@a.com', password: 'secret' });

    expect(mockPost).toHaveBeenCalledWith(
      '/auth/login',
      { email: 'a@a.com', password: 'secret' },
      { headers: {} },
    );
  });
});

describe('loginClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navega para a rota marcada como home e dá refresh no router', async () => {
    mockPost.mockResolvedValue({
      user: {
        routes: [
          { path: '/other', isHome: false },
          { path: '/dashboard', isHome: true },
        ],
      },
    });
    const router = fakeRouter();

    const result = await loginClient({ email: 'a@a.com', password: 'secret' }, router);

    expect(router.push).toHaveBeenCalledWith('/dashboard');
    expect(router.refresh).toHaveBeenCalled();
    expect(result.user.routes).toHaveLength(2);
  });

  it('sem rota marcada como home: cai no fallback /home', async () => {
    mockPost.mockResolvedValue({ user: { routes: [] } });
    const router = fakeRouter();

    await loginClient({ email: 'a@a.com', password: 'secret' }, router);

    expect(router.push).toHaveBeenCalledWith('/home');
  });
});

describe('refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('single-flight: chamadas concorrentes compartilham a mesma promise e só disparam 1 POST', async () => {
    let resolvePost!: () => void;
    mockPost.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePost = resolve;
      }),
    );

    const p1 = refresh();
    const p2 = refresh();

    expect(p1).toBe(p2);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/auth/refresh');

    resolvePost();
    await p1;
    await p2;
  });

  it('depois de resolvida, a próxima chamada dispara um novo POST', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await refresh();
    expect(mockPost).toHaveBeenCalledTimes(1);

    mockPost.mockResolvedValueOnce(undefined);
    await refresh();
    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});

describe('logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, 'clear');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem msg: faz POST de logout e redireciona imediatamente', async () => {
    mockPost.mockResolvedValue(undefined);

    await logout();

    expect(mockPost).toHaveBeenCalledWith('/auth/logout');
    expect(Storage.prototype.clear).toHaveBeenCalled();
    expect(mockQueryClient.cancelQueries).toHaveBeenCalled();
    expect(mockQueryClient.removeQueries).toHaveBeenCalled();
    expect(mockQueryClient.clear).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith('/login');
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('com msg: mostra o toast e só redireciona depois de 3s', async () => {
    vi.useFakeTimers();
    mockPost.mockResolvedValue(undefined);

    await logout('Sessão encerrada');

    expect(toast.info).toHaveBeenCalledWith('Sessão encerrada');
    expect(mockRedirect).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('POST de logout falhando: erro é engolido e ainda assim redireciona', async () => {
    mockPost.mockRejectedValue(new Error('rede caiu'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await logout();

    expect(consoleSpy).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith('/login');

    consoleSpy.mockRestore();
  });
});
