import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleBadge } from './role-badge';

describe('RoleBadge', () => {
  it('renderiza os children e aplica a cor da role conhecida', () => {
    render(<RoleBadge role="ADMIN">Admin</RoleBadge>);

    const badge = screen.getByText('Admin');
    expect(badge).toHaveStyle({ backgroundColor: 'var(--warning)', color: 'var(--warning-foreground)' });
  });

  it('role desconhecida: renderiza sem estilo, sem explodir', () => {
    render(<RoleBadge role="UNKNOWN">Unknown</RoleBadge>);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
