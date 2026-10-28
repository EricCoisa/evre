import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LandingNav } from './landing-nav';

describe('LandingNav', () => {
  it('renders logo, desktop links and default WhatsApp/Portal CTAs', () => {
    render(<LandingNav />);

    expect(screen.getByRole('link', { name: 'EVRE Software House' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Serviços' })).toHaveAttribute('href', '#servicos');
    expect(screen.getByRole('link', { name: 'Processo' })).toHaveAttribute('href', '#processo');
    expect(screen.getByRole('link', { name: 'Contato' })).toHaveAttribute('href', '#contato');
    expect(screen.getByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/login');

    const whatsappLink = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsappLink.getAttribute('href')).toContain('5534953301409');
    expect(whatsappLink).toHaveAttribute('target', '_blank');
  });

  it('uses a custom whatsappNumber prop in the WhatsApp link href', () => {
    render(<LandingNav whatsappNumber="5511999999999" />);

    const whatsappLink = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsappLink.getAttribute('href')).toContain('5511999999999');
  });

  it('opens the mobile menu on toggle button click, showing mobile-only links', async () => {
    const user = userEvent.setup();
    render(<LandingNav />);

    expect(screen.getAllByText('Contato')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Menu' }));

    expect(screen.getAllByText('Contato')).toHaveLength(2);
    expect(screen.getByText('Conversar no WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Portal do Cliente')).toBeInTheDocument();
  });

  it('closes the mobile menu again when the toggle button is clicked a second time', async () => {
    const user = userEvent.setup();
    render(<LandingNav />);

    const toggle = screen.getByRole('button', { name: 'Menu' });
    await user.click(toggle);
    expect(screen.getAllByText('Contato')).toHaveLength(2);

    await user.click(toggle);
    expect(screen.getAllByText('Contato')).toHaveLength(1);
  });

  it('closes the mobile menu when a mobile nav link is clicked', async () => {
    const user = userEvent.setup();
    render(<LandingNav />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const mobileLinks = screen.getAllByText('Contato');
    expect(mobileLinks).toHaveLength(2);

    await user.click(mobileLinks[1]);

    expect(screen.getAllByText('Contato')).toHaveLength(1);
  });
});
