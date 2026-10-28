import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BreadcrumbNav } from './breadcrumb-nav';
import { useMe } from '@/lib/actions/auth/queries';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar';
import { useBread } from '@/contexts/bread-context';
import type { UserRoute } from '@/lib/actions/auth/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: vi.fn(() => ({ state: 'expanded' })),
}));

const setItem = vi.fn();
vi.mock('@/contexts/bread-context', () => ({
  useBread: vi.fn(() => ({ items: null, setItem: vi.fn() })),
}));

vi.mock('@/lib/types/routepages.types', () => ({
  RoutePagesList: [
    {
      path: '/user',
      key: 'data.name',
      getBreadName: (id?: string) => ({
        queryKey: () => ['user', id],
        queryFn: async () => ({ data: { name: `Nome-${id}` } }),
      }),
    },
  ],
}));

function route(overrides: Partial<UserRoute>): UserRoute {
  return {
    id: 'r1',
    path: '/user',
    labelKey: 'usersLabel',
    icon: null,
    parentId: null,
    ordem: 0,
    isHome: false,
    isActive: true,
    showSideBar: true,
    ...overrides,
  };
}

function setup(pathname: string, routes: UserRoute[] = []) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(useMe).mockReturnValue({
    data: { routes },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useBread).mockReturnValue({ items: null, setItem });

  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <BreadcrumbNav />
    </QueryClientProvider>,
  );
}

describe('BreadcrumbNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSidebar).mockReturnValue({ state: 'expanded' } as unknown as ReturnType<typeof useSidebar>);
  });

  it('renders nothing on the redirect page', () => {
    const { container } = setup('/redirect');
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders nothing on the private redirect page', () => {
    const { container } = setup('/(private)/redirect');
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders a registered route as a translated link, not the last crumb', () => {
    setup('/user/42', [route({})]);
    const link = screen.getByText('usersLabel');
    expect(link.closest('a')).toHaveAttribute('href', '/user');
  });

  it('shows "loading" for a dynamic last segment before its query resolves, then the resolved name', async () => {
    setup('/user/42', [route({})]);

    const last = screen.getByText((_, el) => el?.getAttribute('data-slot') === 'breadcrumb-page');
    expect(last.textContent).toBe('loading');

    expect(await screen.findByText('Nome-42')).toBeInTheDocument();
  });

  it('calls setItem with the resolved name of the last dynamic crumb', async () => {
    setup('/user/42', [route({})]);
    await screen.findByText('Nome-42');
    expect(setItem).toHaveBeenCalledWith('Nome-42');
  });

  it('falls back to the raw segment when no route and no dynamic page cover it', () => {
    setup('/unknown/segment', []);
    expect(screen.getByText('unknown')).toBeInTheDocument();
    expect(screen.getByText('segment')).toBeInTheDocument();
  });

  it('renders the last crumb as a non-link breadcrumb page', () => {
    setup('/unknown', []);
    const last = screen.getByText('unknown');
    expect(last).toHaveAttribute('data-slot', 'breadcrumb-page');
    expect(last).toHaveAttribute('aria-current', 'page');
  });
});
