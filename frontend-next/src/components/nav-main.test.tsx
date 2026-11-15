import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { NavMain } from './nav-main';

describe('NavMain', () => {
  it('renderiza o botão Quick Create', () => {
    render(<NavMain />);
    expect(screen.getByText('Quick Create')).toBeInTheDocument();
  });

  it('sem items: não renderiza itens de menu adicionais', () => {
    render(<NavMain items={[]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('com items: renderiza cada título', () => {
    render(
      <NavMain items={[
        { title: 'Dashboard', url: '/dashboard' },
        { title: 'Projetos', url: '/projects' },
      ]}
      />
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Projetos')).toBeInTheDocument();
  });
});
