import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CMSLayoutWrapper } from './cms-layout-wrapper';

const mockUseCMS = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/cms-context', () => ({ useCMS: mockUseCMS }));

describe('CMSLayoutWrapper', () => {
  it('página CMS: layout sem padding, com gap-6', () => {
    mockUseCMS.mockReturnValue({ isCMSPage: true });
    const { container } = render(<CMSLayoutWrapper>conteudo</CMSLayoutWrapper>);

    const main = container.querySelector('main')!;
    expect(main).toHaveClass('gap-6');
    expect(main).not.toHaveClass('p-2');
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });

  it('página comum: layout padrão com padding responsivo', () => {
    mockUseCMS.mockReturnValue({ isCMSPage: false });
    const { container } = render(<CMSLayoutWrapper>conteudo</CMSLayoutWrapper>);

    const main = container.querySelector('main')!;
    expect(main).toHaveClass('p-2', 'sm:p-4', 'lg:p-6');
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });
});
