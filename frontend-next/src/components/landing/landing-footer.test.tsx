import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingFooter } from './landing-footer';

describe('LandingFooter', () => {
  it('renders logo, section links, legal links and copyright', () => {
    render(<LandingFooter />);

    expect(screen.getByRole('link', { name: 'EVRE Software House' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sites' })).toHaveAttribute('href', '#sites');
    expect(screen.getByRole('link', { name: 'Sistemas' })).toHaveAttribute('href', '#sistemas');
    expect(screen.getByRole('link', { name: 'Equipes' })).toHaveAttribute('href', '#equipes');
    expect(screen.getByRole('link', { name: 'Termos' })).toHaveAttribute('href', '/legal/termo-uso');
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', '/legal/privacy-policy');

    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${year}.*EVRE Software House`))).toBeInTheDocument();
  });

  it('renders a custom footerText prop in the copyright line', () => {
    render(<LandingFooter footerText="Minha Empresa" />);

    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${year}.*Minha Empresa`))).toBeInTheDocument();
  });
});
