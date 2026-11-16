import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { LiquidDistortion } from './liquid-distortion';

describe('LiquidDistortion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children and hidden SVG displacement filter', () => {
    const { container } = render(
      <LiquidDistortion>
        <h1>Texto Distorcido</h1>
      </LiquidDistortion>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Texto Distorcido');
    expect(container.querySelector('filter')).toBeInTheDocument();
    expect(container.querySelectorAll('feDisplacementMap').length).toBeGreaterThanOrEqual(1);
  });

  it('applies filter on mouse movement over element', () => {
    let called = false;
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      if (!called) {
        called = true;
        cb(performance.now());
      }
      return 1;
    });

    const { container } = render(
      <LiquidDistortion>
        <h1>Hover Aqui</h1>
      </LiquidDistortion>
    );

    const wrapper = container.firstElementChild as HTMLElement;
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 120,
      width: 400,
      height: 120,
      toJSON: () => ({}),
    });

    fireEvent.mouseMove(window, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(window, { clientX: 90, clientY: 65 });

    expect(rafSpy).toHaveBeenCalled();
    expect(wrapper.style.filter).toContain('url(#liquid-distortion-');
  });
});
