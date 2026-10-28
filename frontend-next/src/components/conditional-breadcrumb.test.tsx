import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConditionalBreadcrumb } from './conditional-breadcrumb';

const mockUsePathname = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ usePathname: mockUsePathname }));

const mockUseMe = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/auth/queries', () => ({ useMe: mockUseMe }));

vi.mock('@/components/breadcrumb-nav', () => ({ BreadcrumbNav: () => <div data-testid="breadcrumb-nav" /> }));

describe('ConditionalBreadcrumb', () => {
  it('na rota home, não renderiza nada', () => {
    mockUsePathname.mockReturnValue('/home');
    mockUseMe.mockReturnValue({ data: { routes: [{ path: '/home', isHome: true }] } });

    const { container } = render(<ConditionalBreadcrumb />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fora da rota home, renderiza o breadcrumb', () => {
    mockUsePathname.mockReturnValue('/settings');
    mockUseMe.mockReturnValue({ data: { routes: [{ path: '/home', isHome: true }] } });

    render(<ConditionalBreadcrumb />);
    expect(screen.getByTestId('breadcrumb-nav')).toBeInTheDocument();
  });

  it('sem dados do usuário (ainda carregando), renderiza o breadcrumb', () => {
    mockUsePathname.mockReturnValue('/settings');
    mockUseMe.mockReturnValue({ data: undefined });

    render(<ConditionalBreadcrumb />);
    expect(screen.getByTestId('breadcrumb-nav')).toBeInTheDocument();
  });
});
