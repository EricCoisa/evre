import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { NavUser } from './nav-user';

describe('NavUser', () => {
  it('renderiza com defaults sem erro (nome e email vazios)', () => {
    const { container } = render(<NavUser />);
    expect(container.firstChild).toBeTruthy();
  });

  it('exibe nome e email do usuário', () => {
    render(<NavUser user={{ name: 'Alice', email: 'alice@x.com', avatar: '' }} />);
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('alice@x.com').length).toBeGreaterThan(0);
  });
});
