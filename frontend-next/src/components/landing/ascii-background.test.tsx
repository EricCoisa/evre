import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsciiBackground } from './ascii-background';

describe('AsciiBackground', () => {
  beforeEach(() => {
    window.requestAnimationFrame = vi.fn().mockReturnValue(1);
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a decorative canvas with default classes', () => {
    const { container } = render(<AsciiBackground />);

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas?.className).toContain('absolute');
    expect(canvas?.className).toContain('inset-0');
  });

  it('merges a custom className into the canvas', () => {
    const { container } = render(<AsciiBackground className="custom-extra" />);

    const canvas = container.querySelector('canvas');
    expect(canvas?.className).toContain('custom-extra');
  });

  it('mounts and unmounts cleanly with a custom charDensity, without throwing', () => {
    const { unmount } = render(<AsciiBackground charDensity={16} />);

    expect(() => unmount()).not.toThrow();
  });

  it('does not throw cleaning up on unmount (covers the effect teardown path)', () => {
    const { unmount } = render(<AsciiBackground />);

    expect(() => unmount()).not.toThrow();
  });

  it('does not crash when the window is resized while mounted', () => {
    render(<AsciiBackground />);

    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
  });
});
