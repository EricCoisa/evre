import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renderiza título obrigatório e descrição opcional', () => {
    render(
      <PageHeader
        title="Título de Teste"
        description="Descrição detalhada da página de teste"
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: /título de teste/i })).toBeInTheDocument();
    expect(screen.getByText('Descrição detalhada da página de teste')).toBeInTheDocument();
  });

  it('renderiza badge e ações quando fornecidos', () => {
    render(
      <PageHeader
        title="Título com Ações"
        badge={<span data-testid="test-badge">Badge</span>}
        actions={<button type="button">Nova Ação</button>}
      />
    );

    expect(screen.getByTestId('test-badge')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nova ação/i })).toBeInTheDocument();
  });
});

