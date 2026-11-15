import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwitchField } from './switch-field';

describe('SwitchField — layout empilhado (padrão)', () => {
  it('renderiza o switch', () => {
    render(<SwitchField checked={false} onCheckedChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('exibe label quando fornecida', () => {
    render(<SwitchField checked={false} onCheckedChange={vi.fn()} label="Ativar" />);
    expect(screen.getByText('Ativar')).toBeInTheDocument();
  });

  it('exibe description quando fornecida', () => {
    render(<SwitchField checked={false} onCheckedChange={vi.fn()} description="Detalhe" />);
    expect(screen.getByText('Detalhe')).toBeInTheDocument();
  });

  it('disabled desabilita o switch', () => {
    render(<SwitchField checked={false} onCheckedChange={vi.fn()} disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('chama onCheckedChange ao alternar', async () => {
    const onChange = vi.fn();
    render(<SwitchField checked={false} onCheckedChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('SwitchField — layout inline', () => {
  it('renderiza switch e label na mesma linha', () => {
    render(<SwitchField checked={true} onCheckedChange={vi.fn()} inline label="Inline" />);
    expect(screen.getByText('Inline')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('inline sem label: só renderiza o switch', () => {
    const { container } = render(<SwitchField checked={false} onCheckedChange={vi.fn()} inline />);
    expect(container.querySelectorAll('label')).toHaveLength(0);
  });
});
