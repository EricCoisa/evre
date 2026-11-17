import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FinalCtaSection } from './final-cta-section';

describe('FinalCtaSection', () => {
  it('renders default title and WhatsApp CTA', () => {
    render(<FinalCtaSection />);

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();

    const whatsappLink = screen.getByRole('link');
    expect(whatsappLink.getAttribute('href')).toContain('5534953301409');
    expect(whatsappLink).toHaveAttribute('target', '_blank');
  });

  it('renders custom title, buttonText and whatsapp number', () => {
    render(
      <FinalCtaSection
        title="Fale com a gente"
        buttonText="Chamar agora"
        whatsappNumber="5511999999999"
      />
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Fale com a gente');
    const whatsappLink = screen.getByRole('link', { name: /Chamar agora/ });
    expect(whatsappLink.getAttribute('href')).toContain('5511999999999');
  });
});
