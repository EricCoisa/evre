import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LandingNav } from './landing-nav';

describe('LandingNav', () => {
  it('renders logo, desktop links and default CTAs', () => {
    render(<LandingNav />);

    expect(screen.getByRole('link', { name: 'EVRE Software House' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Sites' })).toHaveAttribute('href', '#sites');
    expect(screen.getByRole('link', { name: 'Sistemas' })).toHaveAttribute('href', '#sistemas');
    expect(screen.getByRole('link', { name: 'Equipes' })).toHaveAttribute('href', '#equipes');
    expect(screen.getByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/login');

    const whatsappLink = screen.getByRole('link', { name: 'Falar com a equipe' });
    expect(whatsappLink.getAttribute('href')).toContain('5534953301409');
    expect(whatsappLink).toHaveAttribute('target', '_blank');
  });

  it('uses a custom whatsappNumber prop in the WhatsApp link href', () => {
    render(<LandingNav whatsappNumber="5511999999999" />);

    const whatsappLink = screen.getByRole('link', { name: 'Falar com a equipe' });
    expect(whatsappLink.getAttribute('href')).toContain('5511999999999');
  });

  it('opens the mobile menu on toggle button click', async () => {
    const user = userEvent.setup();
    render(<LandingNav />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));

    expect(screen.getByText('Portal do Cliente')).toBeInTheDocument();
  });

  it('closes the mobile menu again when the toggle button is clicked a second time', async () => {
    const user = userEvent.setup();
    render(<LandingNav />);

    const toggle = screen.getByRole('button', { name: 'Menu' });
    await user.click(toggle);
    expect(screen.getByText('Portal do Cliente')).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText('Portal do Cliente')).toBeNull();
  });

  it('closes the mobile menu when a mobile nav link is clicked', async () => {
    const user = userEvent.setup();
    render(<LandingNav />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText('Portal do Cliente')).toBeInTheDocument();

    const sitesMobileLinks = screen.getAllByText('Sites & Landing Pages');
    await user.click(sitesMobileLinks[0]);

    expect(screen.queryByText('Portal do Cliente')).toBeNull();
  });
});
