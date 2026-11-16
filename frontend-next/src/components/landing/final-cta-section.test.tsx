import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinalCtaSection } from './final-cta-section';

describe('FinalCtaSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders default title, WhatsApp CTA and contact email', () => {
    render(<FinalCtaSection />);

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();

    const whatsappLink = screen.getByRole('link');
    expect(whatsappLink.getAttribute('href')).toContain('5534953301409');
    expect(whatsappLink).toHaveAttribute('target', '_blank');

    expect(screen.getByText('contato@evre.com.br')).toBeInTheDocument();
  });

  it('renders custom title/buttonText/email/whatsapp number', () => {
    render(
      <FinalCtaSection
        title="Fale com a gente"
        buttonText="Chamar agora"
        whatsappNumber="5511999999999"
        contactEmail="custom@exemplo.com"
      />
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Fale com a gente');
    const whatsappLink = screen.getByRole('link', { name: /Chamar agora/ });
    expect(whatsappLink.getAttribute('href')).toContain('5511999999999');
    expect(screen.getByText('custom@exemplo.com')).toBeInTheDocument();
  });

  it('copies the e-mail to the clipboard when clicking the email button', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<FinalCtaSection />);

    const copyButton = screen.getByRole('button', { name: /contato@evre\.com\.br/ });
    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('contato@evre.com.br');
  });
});
