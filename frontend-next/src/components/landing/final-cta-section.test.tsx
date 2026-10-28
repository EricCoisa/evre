import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinalCtaSection } from './final-cta-section';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

describe('FinalCtaSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders default title, description, WhatsApp CTA and contact email', () => {
    render(<FinalCtaSection />);

    expect(screen.getByText('Vamos conversar sobre o seu projeto?')).toBeInTheDocument();
    expect(
      screen.getByText('Entre em contato diretamente para avaliarmos sua demanda e entender como podemos ajudar.')
    ).toBeInTheDocument();

    const whatsappLink = screen.getByRole('link', { name: /Chamar no WhatsApp/ });
    expect(whatsappLink.getAttribute('href')).toContain('5534953301409');
    expect(whatsappLink).toHaveAttribute('target', '_blank');

    expect(screen.getByText('contato@evre.com.br')).toBeInTheDocument();
  });

  it('renders custom props for title/description/button text/email/whatsapp number', () => {
    render(
      <FinalCtaSection
        title="Fale com a gente"
        description="Descrição custom"
        whatsappButtonText="Chamar agora"
        whatsappNumber="5511999999999"
        contactEmail="custom@exemplo.com"
      />
    );

    expect(screen.getByText('Fale com a gente')).toBeInTheDocument();
    expect(screen.getByText('Descrição custom')).toBeInTheDocument();
    const whatsappLink = screen.getByRole('link', { name: /Chamar agora/ });
    expect(whatsappLink.getAttribute('href')).toContain('5511999999999');
    expect(screen.getByText('custom@exemplo.com')).toBeInTheDocument();
  });

  it('copies the e-mail to the clipboard, shows the "copied" check icon and fires a success toast', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<FinalCtaSection />);

    const copyButton = screen.getByRole('button', { name: /contato@evre\.com\.br/ });
    expect(copyButton.querySelector('svg.lucide-mail')).toBeTruthy();

    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('contato@evre.com.br');
    expect(toast.success).toHaveBeenCalledWith('E-mail copiado para a área de transferência');
    expect(copyButton.querySelector('svg.lucide-check')).toBeTruthy();
    expect(copyButton.querySelector('svg.lucide-mail')).toBeNull();
  });
});
