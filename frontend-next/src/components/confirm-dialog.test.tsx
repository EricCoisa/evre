import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './confirm-dialog';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function open(overrides = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Excluir item',
    ...overrides,
  };
}

describe('ConfirmDialog', () => {
  it('fechado: não renderiza nada', () => {
    render(<ConfirmDialog {...open({ open: false })} />);
    expect(screen.queryByText('Excluir item')).not.toBeInTheDocument();
  });

  it('aberto: renderiza título e botões padrão', () => {
    render(<ConfirmDialog {...open()} />);
    expect(screen.getByText('Excluir item')).toBeInTheDocument();
    expect(screen.getByText('cancel')).toBeInTheDocument();
    expect(screen.getByText('confirm')).toBeInTheDocument();
  });

  it('description: renderiza quando fornecida', () => {
    render(<ConfirmDialog {...open({ description: 'Esta ação é irreversível' })} />);
    expect(screen.getByText('Esta ação é irreversível')).toBeInTheDocument();
  });

  it('confirmLabel / cancelLabel: substitui os labels padrão', () => {
    render(<ConfirmDialog {...open({ confirmLabel: 'Sim', cancelLabel: 'Não' })} />);
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
  });

  it('clicar em confirmar chama onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...open({ onConfirm })} />);
    await userEvent.click(screen.getByText('confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });
});
