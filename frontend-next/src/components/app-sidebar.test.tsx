import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppSidebar } from './app-sidebar';
import { getServerAccessToken } from '@/lib/actions/auth/server-auth';
import { serverMe } from '@/lib/server-context';
import type { UserRoute } from '@/lib/actions/auth/types';

vi.mock('@/lib/actions/auth/server-auth', () => ({ getServerAccessToken: vi.fn() }));
vi.mock('@/lib/server-context', () => ({ serverMe: vi.fn() }));

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('./ui/langLabel', () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));
vi.mock('./sidebar-logo', () => ({
  SidebarLogo: ({ homeUrl }: { homeUrl: string }) => <div data-testid="logo" data-home={homeUrl} />,
}));
vi.mock('./sidebar-nav', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarNav: ({ navItems }: { navItems: any[] }) => <div data-testid="nav" data-count={navItems.length} />,
}));

function route(overrides: Partial<UserRoute>): UserRoute {
  return {
    id: 'r1', path: '/home', labelKey: 'home', icon: null, parentId: null,
    ordem: 0, isHome: false, isActive: true, showSideBar: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AppSidebar', () => {
  it('sem access token: não busca o usuário e renderiza sem rotas', async () => {
    vi.mocked(getServerAccessToken).mockResolvedValue(undefined);

    const node = await AppSidebar();
    render(node);

    expect(serverMe).not.toHaveBeenCalled();
    expect(screen.getByTestId('nav')).toHaveAttribute('data-count', '0');
    expect(screen.getByTestId('logo')).toHaveAttribute('data-home', '/home');
  });

  it('com access token: busca o usuário e filtra rotas por showSideBar', async () => {
    vi.mocked(getServerAccessToken).mockResolvedValue('token');
    vi.mocked(serverMe).mockResolvedValue({
      routes: [
        route({ id: 'visible', showSideBar: true }),
        route({ id: 'hidden', showSideBar: false }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const node = await AppSidebar();
    render(node);

    expect(serverMe).toHaveBeenCalled();
    expect(screen.getByTestId('nav')).toHaveAttribute('data-count', '1');
  });

  it('usa o path da rota isHome como homeUrl do logo', async () => {
    vi.mocked(getServerAccessToken).mockResolvedValue('token');
    vi.mocked(serverMe).mockResolvedValue({
      routes: [route({ id: 'home-route', path: '/dashboard', isHome: true, showSideBar: true })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const node = await AppSidebar();
    render(node);

    expect(screen.getByTestId('logo')).toHaveAttribute('data-home', '/dashboard');
  });

  it('serverMe resolve sem usuário: trata como lista de rotas vazia', async () => {
    vi.mocked(getServerAccessToken).mockResolvedValue('token');
    vi.mocked(serverMe).mockResolvedValue(null);

    const node = await AppSidebar();
    render(node);

    expect(screen.getByTestId('nav')).toHaveAttribute('data-count', '0');
    expect(screen.getByTestId('logo')).toHaveAttribute('data-home', '/home');
  });
});
