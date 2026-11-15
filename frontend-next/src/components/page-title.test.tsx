import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseBread = vi.hoisted(() => vi.fn(() => ({ items: null as string | null })));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('@/contexts/bread-context', () => ({
  useBread: mockUseBread,
}));
vi.mock('@/lib/route-tree', () => ({
  matchRoute: () => null,
}));

import { PageTitle } from './page-title';

describe('PageTitle', () => {
  it('renderiza heading com o segmento da rota quando sem rota correspondente', () => {
    render(<PageTitle />);
    // pathname='/' → lastSegment='home' → t('home') = 'home'
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('home');
  });

  it('usa items do bread context quando disponível', () => {
    mockUseBread.mockReturnValue({ items: 'Projetos' });
    render(<PageTitle />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Projetos');
  });
});
