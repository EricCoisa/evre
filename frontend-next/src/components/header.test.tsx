import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils';

const mockUseApp = vi.hoisted(() => vi.fn());
const mockIsDevelopment = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/appProvider', () => ({
  useApp: mockUseApp,
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return { ...actual, isDevelopment: mockIsDevelopment };
});
vi.mock('@/lib/role-utils', () => ({ isClientUser: () => false }));
vi.mock('./user-menu', () => ({ UserMenu: () => <div data-testid="user-menu" /> }));
vi.mock('./theme-toggle', () => ({ ThemeToggle: () => <div data-testid="theme-toggle" /> }));
vi.mock('./notification-bell', () => ({ NotificationBell: () => <div data-testid="notif-bell" /> }));
vi.mock('./breadcrumb-nav', () => ({ BreadcrumbNav: () => <nav aria-label="breadcrumb" /> }));
vi.mock('./resource-search', () => ({ ResourceSearch: () => <div data-testid="resource-search" /> }));
vi.mock('./time-tracking/header-time-tracker', () => ({ HeaderTimeTracker: () => <div data-testid="time-tracker" /> }));
vi.mock('@/components/feature', () => ({ Feature: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { Header } from './header';

beforeEach(() => {
  mockUseApp.mockReturnValue({ devTools: false, setDevTools: vi.fn() });
  mockIsDevelopment.mockReturnValue(false);
  vi.clearAllMocks();
});

describe('Header', () => {
  it('renderiza o header sem erros', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renderiza o ThemeToggle e UserMenu sempre', () => {
    render(<Header />);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('notificationsEnabled=true: renderiza o NotificationBell', () => {
    render(<Header notificationsEnabled={true} />);
    expect(screen.getByTestId('notif-bell')).toBeInTheDocument();
  });

  it('notificationsEnabled=false (default): não renderiza o NotificationBell', () => {
    render(<Header />);
    expect(screen.queryByTestId('notif-bell')).not.toBeInTheDocument();
  });

  it('em desenvolvimento: renderiza o switch de DevTools', () => {
    mockIsDevelopment.mockReturnValue(true);
    render(<Header />);
    expect(screen.getByRole('switch', { name: 'DevTools' })).toBeInTheDocument();
  });

  it('fora de desenvolvimento: não renderiza o switch de DevTools', () => {
    mockIsDevelopment.mockReturnValue(false);
    render(<Header />);
    expect(screen.queryByRole('switch', { name: 'DevTools' })).not.toBeInTheDocument();
  });
});
