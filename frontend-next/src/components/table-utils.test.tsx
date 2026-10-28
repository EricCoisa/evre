import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableHead, DataCell, DataCellModal } from './table-utils';

describe('TableHead', () => {
  it('renders children with the table-head slot', () => {
    render(<TableHead>Header</TableHead>);
    const el = screen.getByText('Header');
    expect(el).toHaveAttribute('data-slot', 'table-head');
  });

  it('merges a custom className', () => {
    render(<TableHead className="custom-head">Header</TableHead>);
    expect(screen.getByText('Header')).toHaveClass('custom-head');
  });
});

describe('DataCell', () => {
  it('renders the children when provided', () => {
    render(<DataCell>conteudo</DataCell>);
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });

  it('falls back to a dash when children is falsy', () => {
    render(<DataCell>{null}</DataCell>);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('applies the cursor-pointer class when pointer is set', () => {
    render(<DataCell pointer>conteudo</DataCell>);
    expect(screen.getByText('conteudo')).toHaveClass('cursor-pointer');
  });

  it('applies the cursor-default class when pointer is not set', () => {
    render(<DataCell>conteudo</DataCell>);
    expect(screen.getByText('conteudo')).toHaveClass('cursor-default');
  });

  it('uses a numeric maxWidth as the inline style', () => {
    render(<DataCell maxWidth={120}>conteudo</DataCell>);
    expect(screen.getByText('conteudo')).toHaveStyle({ maxWidth: '120px' });
  });

  it('defaults maxWidth to auto when not provided', () => {
    render(<DataCell>conteudo</DataCell>);
    expect(screen.getByText('conteudo')).toHaveStyle({ maxWidth: 'auto' });
  });
});

describe('DataCellModal', () => {
  it('shows the title as the cell content when cellChildren is not provided', () => {
    render(<DataCellModal title="Título">Detalhe</DataCellModal>);
    expect(screen.getByText('Título')).toBeInTheDocument();
  });

  it('shows cellChildren instead of the title in the cell when provided', () => {
    render(
      <DataCellModal title="Título" cellChildren={<span>Resumo</span>}>
        Detalhe
      </DataCellModal>,
    );
    expect(screen.getByText('Resumo')).toBeInTheDocument();
    expect(screen.queryByText('Título')).toBeNull();
  });

  it('opens a dialog with the title and children when the cell is clicked', async () => {
    const user = userEvent.setup();
    render(<DataCellModal title="Título">Conteúdo detalhado</DataCellModal>);

    expect(screen.queryByText('Conteúdo detalhado')).toBeNull();

    await user.click(screen.getByText('Título'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo detalhado')).toBeInTheDocument();
    // O título aparece tanto na célula quanto no header do diálogo.
    expect(screen.getAllByText('Título').length).toBe(2);
  });
});
