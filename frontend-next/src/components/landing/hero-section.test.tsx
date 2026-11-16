import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeroSection } from './hero-section';

vi.mock('./ascii-background', () => ({
  AsciiBackground: () => <div data-testid="ascii-bg" />,
}));

describe('HeroSection', () => {
  it('renders default title and ascii background', () => {
    render(<HeroSection />);

    expect(screen.getByTestId('ascii-bg')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders custom title and cta props', () => {
    render(<HeroSection title="Título customizado" cta="Fale agora" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Título customizado');
    expect(screen.getByText('Fale agora')).toBeInTheDocument();
  });

  it('builds the WhatsApp href from the whatsappNumber prop', () => {
    render(<HeroSection whatsappNumber="5511999999999" />);

    const primaryCta = screen.getAllByRole('link').find(l =>
      l.getAttribute('href')?.includes('5511999999999')
    );
    expect(primaryCta).toBeTruthy();
    expect(primaryCta).toHaveAttribute('target', '_blank');
  });
});
