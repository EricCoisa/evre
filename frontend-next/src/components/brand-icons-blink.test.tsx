import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandIconsBlink } from './brand-icons-blink';

describe('BrandIconsBlink', () => {
  it('renderiza os três ícones da marca em ordem', () => {
    render(<BrandIconsBlink />);

    const play = screen.getByTestId('brand-icon-play');
    const slash = screen.getByTestId('brand-icon-slash');
    const playInverse = screen.getByTestId('brand-icon-play-inverse');

    expect(play).toBeInTheDocument();
    expect(slash).toBeInTheDocument();
    expect(playInverse).toBeInTheDocument();
  });

  it('aplica o delay de animação escalonado em ordem (0s, 0.5s, 1s para 1.5s total)', () => {
    render(<BrandIconsBlink duration={1.5} />);

    const play = screen.getByTestId('brand-icon-play');
    const slash = screen.getByTestId('brand-icon-slash');
    const playInverse = screen.getByTestId('brand-icon-play-inverse');

    expect(play.style.animationDelay).toBe('0s');
    expect(slash.style.animationDelay).toBe('0.5s');
    expect(playInverse.style.animationDelay).toBe('1s');
  });

  it('respeita tamanhos pré-definidos e numéricos', () => {
    const { unmount } = render(<BrandIconsBlink size="sm" />);
    const playSm = screen.getByTestId('brand-icon-play');
    expect(playSm.style.width).toBe('24px');
    expect(playSm.style.height).toBe('24px');
    unmount();

    render(<BrandIconsBlink size={48} />);
    const playCustom = screen.getByTestId('brand-icon-play');
    expect(playCustom.style.width).toBe('48px');
    expect(playCustom.style.height).toBe('48px');
  });

  it('possui role="status" e texto de acessibilidade padrão', () => {
    render(<BrandIconsBlink />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Carregando...');
  });
});
