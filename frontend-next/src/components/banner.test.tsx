import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Banner } from './banner';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('Banner', () => {
  it('renderiza as chaves de tradução da variante login por padrão', () => {
    render(<Banner />);
    expect(screen.getByText('banner.login.title')).toBeInTheDocument();
    expect(screen.getByText('banner.login.description')).toBeInTheDocument();
  });

  it('renderiza as chaves da variante informada', () => {
    render(<Banner variant="signup" />);
    expect(screen.getByText('banner.signup.title')).toBeInTheDocument();
  });

  it('usa o logo branco fixo sobre o fundo primary', () => {
    render(<Banner />);
    expect(screen.getByAltText('EVRE').getAttribute('src')).toContain('logo-white.svg');
  });
});
