import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteNode } from '@/lib/route-tree';
import { SidebarNav } from './sidebar-nav';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const pathnameMock = vi.hoisted(() => vi.fn().mockReturnValue('/dashboard'));
vi.mock('next/navigation', () => ({ usePathname: () => pathnameMock() }));

const sidebarMock = vi.hoisted(() => vi.fn().mockReturnValue({ isMobile: false, setOpenMobile: vi.fn() }));
vi.mock('@/components/ui/sidebar', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenu: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenuItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenuSub: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenuSubItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenuButton: ({ children, isActive, className }: any) => (
    <div data-slot="menu-button" data-active={String(!!isActive)} className={className}>
      {children}
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SidebarMenuSubButton: ({ children, isActive, className }: any) => (
    <div data-slot="menu-sub-button" data-active={String(!!isActive)} className={className}>
      {children}
    </div>
  ),
  useSidebar: () => sidebarMock(),
}));

const CHILD_PROFILE: RouteNode = {
  id: 'c-profile', path: '/settings/profile', labelKey: 'nav.settings.profile', icon: null,
  parentId: 'r-settings', ordem: 1, isHome: false, isActive: true, showSideBar: true, children: [],
};
const CHILD_SECURITY: RouteNode = {
  id: 'c-security', path: '/settings/security', labelKey: 'nav.settings.security', icon: null,
  parentId: 'r-settings', ordem: 2, isHome: false, isActive: true, showSideBar: true, children: [],
};
const ROOT_SETTINGS: RouteNode = {
  id: 'r-settings', path: '/settings', labelKey: 'nav.settings', icon: 'settings',
  parentId: null, ordem: 2, isHome: false, isActive: true, showSideBar: true,
  children: [CHILD_PROFILE, CHILD_SECURITY],
};
const ROOT_DASHBOARD: RouteNode = {
  id: 'r-dash', path: '/dashboard', labelKey: 'nav.dashboard', icon: 'layout-dashboard',
  parentId: null, ordem: 1, isHome: true, isActive: true, showSideBar: true, children: [],
};
const NAV_ITEMS: RouteNode[] = [ROOT_DASHBOARD, ROOT_SETTINGS];

function linkFor(href: string) {
  return document.querySelector(`a[href="${href}"]`) as HTMLAnchorElement;
}

beforeEach(() => {
  pathnameMock.mockReturnValue('/dashboard');
  sidebarMock.mockReturnValue({ isMobile: false, setOpenMobile: vi.fn() });
});

describe('SidebarNav', () => {
  it('renderiza um link por item, incluindo os filhos, com o href e o labelKey certos', () => {
    render(<SidebarNav navItems={NAV_ITEMS} />);

    expect(linkFor('/dashboard')).toHaveTextContent('nav.dashboard');
    expect(linkFor('/settings')).toHaveTextContent('nav.settings');
    expect(linkFor('/settings/profile')).toHaveTextContent('nav.settings.profile');
    expect(linkFor('/settings/security')).toHaveTextContent('nav.settings.security');
  });

  it('não renderiza nada quando navItems é omitido (default [])', () => {
    const { container } = render(<SidebarNav />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('só o item com filhos recebe o botão de expandir/colapsar', () => {
    render(<SidebarNav navItems={NAV_ITEMS} />);

    expect(within(linkFor('/dashboard')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(linkFor('/settings')).getByRole('button')).toBeInTheDocument();
  });

  it('marca como ativo (data-active) apenas o item cujo path é o pathname atual', () => {
    pathnameMock.mockReturnValue('/dashboard');
    render(<SidebarNav navItems={NAV_ITEMS} />);

    expect(linkFor('/dashboard').closest('[data-slot="menu-button"]')).toHaveAttribute('data-active', 'true');
    expect(linkFor('/settings').closest('[data-slot="menu-button"]')).toHaveAttribute('data-active', 'false');
  });

  it('o grupo com filhos começa colapsado quando o pathname não está sob ele', () => {
    pathnameMock.mockReturnValue('/dashboard');
    render(<SidebarNav navItems={NAV_ITEMS} />);

    const toggle = within(linkFor('/settings')).getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'expand');
  });

  it('o grupo reabre automaticamente quando o pathname está sob um de seus filhos', () => {
    pathnameMock.mockReturnValue('/settings/profile');
    render(<SidebarNav navItems={NAV_ITEMS} />);

    const toggle = within(linkFor('/settings')).getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(linkFor('/settings/profile').closest('[data-slot="menu-sub-button"]')).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(linkFor('/settings/security').closest('[data-slot="menu-sub-button"]')).toHaveAttribute(
      'data-active',
      'false',
    );
  });

  it('clicar no botão de expandir alterna aria-expanded sem navegar nem fechar o sidebar mobile', async () => {
    const setOpenMobile = vi.fn();
    sidebarMock.mockReturnValue({ isMobile: true, setOpenMobile });
    render(<SidebarNav navItems={NAV_ITEMS} />);

    const toggle = within(linkFor('/settings')).getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'collapse');
    expect(setOpenMobile).not.toHaveBeenCalled();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(setOpenMobile).not.toHaveBeenCalled();
  });

  it('clicar no link fecha o sidebar mobile quando isMobile é true', async () => {
    const setOpenMobile = vi.fn();
    sidebarMock.mockReturnValue({ isMobile: true, setOpenMobile });
    render(<SidebarNav navItems={NAV_ITEMS} />);

    await userEvent.click(linkFor('/dashboard'));
    expect(setOpenMobile).toHaveBeenCalledWith(false);
  });

  it('clicar no link não toca no sidebar mobile quando isMobile é false', async () => {
    const setOpenMobile = vi.fn();
    sidebarMock.mockReturnValue({ isMobile: false, setOpenMobile });
    render(<SidebarNav navItems={NAV_ITEMS} />);

    await userEvent.click(linkFor('/dashboard'));
    expect(setOpenMobile).not.toHaveBeenCalled();
  });
});
