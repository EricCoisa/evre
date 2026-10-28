import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flashHashTarget } from './hash-target';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    cb();
    return 0;
  });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  document.body.innerHTML = '';
  window.location.hash = '';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('flashHashTarget', () => {
  it('does nothing when there is no hash', () => {
    const el = document.createElement('div');
    el.id = 'target';
    document.body.appendChild(el);

    flashHashTarget();

    expect(el.classList.length).toBe(0);
  });

  it('gives up after 5 retries when the target never appears', () => {
    window.location.hash = '#missing';

    expect(() => {
      flashHashTarget();
      vi.advanceTimersByTime(100 * 5);
    }).not.toThrow();
  });

  it('pulses a ring on a button target, then removes it', () => {
    window.location.hash = '#save-btn';
    const btn = document.createElement('button');
    btn.id = 'save-btn';
    document.body.appendChild(btn);

    flashHashTarget();

    expect(btn.classList.contains('ring-4')).toBe(true);
    expect(btn.classList.contains('animate-pulse')).toBe(true);
    expect(btn.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });

    vi.advanceTimersByTime(1800);
    expect(btn.classList.contains('ring-4')).toBe(false);
  });

  it('treats role="button" and .btn the same as a <button> tag', () => {
    window.location.hash = '#role-btn';
    const el = document.createElement('div');
    el.id = 'role-btn';
    el.setAttribute('role', 'button');
    document.body.appendChild(el);

    flashHashTarget();

    expect(el.classList.contains('ring-4')).toBe(true);
  });

  it('highlights the background on a non-button target, then removes it', () => {
    window.location.hash = '#row';
    const row = document.createElement('div');
    row.id = 'row';
    document.body.appendChild(row);

    flashHashTarget();

    expect(row.classList.contains('bg-primary/10')).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(row.classList.contains('bg-primary/10')).toBe(false);
  });

  it('retries until the target shows up asynchronously', () => {
    window.location.hash = '#late';

    flashHashTarget();
    expect(document.getElementById('late')).toBeNull();

    const late = document.createElement('div');
    late.id = 'late';
    document.body.appendChild(late);

    vi.advanceTimersByTime(100);
    expect(late.classList.contains('bg-primary/10')).toBe(true);
  });

  it('does nothing outside the browser (no window)', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simula execução fora do browser
    delete globalThis.window;

    try {
      expect(() => flashHashTarget()).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
