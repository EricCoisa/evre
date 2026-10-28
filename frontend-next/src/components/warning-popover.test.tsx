import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WarningPopover } from './warning-popover';

const mockUseMe = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/auth/queries', () => ({ useMe: mockUseMe }));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('WarningPopover', () => {
  it('usuário não-admin: não renderiza nada', () => {
    mockUseMe.mockReturnValue({ data: { role: 'USER' } });
    const { container } = render(<WarningPopover reason="algo errado" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sem usuário resolvido ainda (role null): mostra o aviso', () => {
    mockUseMe.mockReturnValue({ data: undefined });
    render(<WarningPopover />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('admin sem reason: mostra só o ícone, sem popover', () => {
    mockUseMe.mockReturnValue({ data: { role: 'ADMIN' } });
    render(<WarningPopover className="extra" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveClass('extra');
  });

  it('admin com reason string: expõe como aria-label/title e no conteúdo do popover', () => {
    mockUseMe.mockReturnValue({ data: { role: 'ADMIN' } });
    render(<WarningPopover reason="provider fora do ar" />);

    const button = screen.getByRole('button', { name: 'provider fora do ar' });
    expect(button).toHaveAttribute('title', 'provider fora do ar');

    fireEvent.click(button);
    expect(screen.getByText('provider fora do ar')).toBeInTheDocument();
  });

  it('reason não-string: usa o texto traduzido de "indisponível" no label', () => {
    mockUseMe.mockReturnValue({ data: { role: 'ADMIN' } });
    render(<WarningPopover reason={<span>detalhe rico</span>} />);

    const button = screen.getByRole('button', { name: 'capability.unavailable' });
    fireEvent.click(button);
    expect(screen.getByText('detalhe rico')).toBeInTheDocument();
  });

  it('com fixPath: mostra o link de configurar apontando para o destino', () => {
    mockUseMe.mockReturnValue({ data: { role: 'ADMIN' } });
    render(<WarningPopover reason="erro" fixPath="/settings/email" />);
    fireEvent.click(screen.getByRole('button', { name: 'erro' }));

    const link = screen.getByRole('link', { name: /configure/ });
    expect(link).toHaveAttribute('href', '/settings/email');
  });

  it('sem fixPath: não mostra link nenhum', () => {
    mockUseMe.mockReturnValue({ data: { role: 'ADMIN' } });
    render(<WarningPopover reason="erro" />);
    fireEvent.click(screen.getByRole('button', { name: 'erro' }));

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
