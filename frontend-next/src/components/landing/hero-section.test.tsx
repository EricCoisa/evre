import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeroSection } from './hero-section';

vi.mock('./ascii-background', () => ({
  AsciiBackground: () => <div data-testid="ascii-bg" />,
}));

describe('HeroSection', () => {
  it('renders default title, description and process card labels', () => {
    render(<HeroSection />);

    expect(
      screen.getByText('Desenvolvimento de software sob medida para empresas e produtos digitais.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Desenvolvemos sistemas, plataformas e aplicativos sob medida para o seu modelo de negócio.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Planejamento')).toBeInTheDocument();
    expect(screen.getByText('Desenvolvimento')).toBeInTheDocument();
    expect(screen.getByText('Entrega')).toBeInTheDocument();
    expect(screen.getByTestId('ascii-bg')).toBeInTheDocument();
  });

  it('renders custom title/description/button text props', () => {
    render(
      <HeroSection
        title="Título customizado"
        description="Descrição customizada"
        primaryButtonText="Fale agora"
        secondaryButtonText="Veja mais"
      />
    );

    expect(screen.getByText('Título customizado')).toBeInTheDocument();
    expect(screen.getByText('Descrição customizada')).toBeInTheDocument();
    expect(screen.getByText('Fale agora')).toBeInTheDocument();
    expect(screen.getByText('Veja mais')).toBeInTheDocument();
  });

  it('builds the WhatsApp href from the whatsappNumber prop and links the secondary CTA to #servicos', () => {
    render(<HeroSection whatsappNumber="5511999999999" />);

    const primaryCta = screen.getByRole('link', { name: /Falar no WhatsApp/ });
    expect(primaryCta.getAttribute('href')).toContain('5511999999999');
    expect(primaryCta).toHaveAttribute('target', '_blank');

    const secondaryCta = screen.getByRole('link', { name: /Conhecer nossos serviços/ });
    expect(secondaryCta).toHaveAttribute('href', '#servicos');
  });
});
