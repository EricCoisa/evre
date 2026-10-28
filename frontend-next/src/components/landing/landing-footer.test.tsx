import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LandingFooter } from './landing-footer';

describe('LandingFooter', () => {
  it('renders default footer text, nav/legal links and current-year copyright', () => {
    render(<LandingFooter />);

    expect(screen.getAllByAltText('EVRE Software House').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Serviços' })).toHaveAttribute('href', '#servicos');
    expect(screen.getByRole('link', { name: 'Processo' })).toHaveAttribute('href', '#processo');
    expect(screen.getByRole('link', { name: 'Contato' })).toHaveAttribute('href', '#contato');
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute(
      'href',
      '/legal/termo-uso'
    );
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/legal/privacy-policy'
    );

    const year = new Date().getFullYear();
    expect(
      screen.getByText(`© ${year} EVRE Software House. Todos os direitos reservados.`)
    ).toBeInTheDocument();
  });

  it('renders a custom footerText prop in the logo alt and copyright line', () => {
    render(<LandingFooter footerText="Minha Empresa" />);

    expect(screen.getAllByAltText('Minha Empresa').length).toBeGreaterThan(0);
    const year = new Date().getFullYear();
    expect(
      screen.getByText(`© ${year} Minha Empresa. Todos os direitos reservados.`)
    ).toBeInTheDocument();
  });

  it('scrolls to top when the "Voltar ao topo" button is clicked', async () => {
    window.scrollTo = vi.fn();
    const user = userEvent.setup();
    render(<LandingFooter />);

    await user.click(screen.getByRole('button', { name: 'Voltar ao topo' }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
