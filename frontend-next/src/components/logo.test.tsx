import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Logo } from './logo';

const srcs = (c: HTMLElement) => [...c.querySelectorAll('img')].map(i => decodeURIComponent(i.getAttribute('src') ?? ''));

describe('Logo', () => {
  it('auto renderiza as duas versões e alterna pelo tema via dark:', () => {
    const { container } = render(<Logo />);
    const [black, white] = [...container.querySelectorAll('img')];
    expect(srcs(container)).toEqual(expect.arrayContaining([expect.stringContaining('logo-black.svg'), expect.stringContaining('logo-white.svg')]));
    expect(black.className).toContain('dark:hidden');
    expect(white.className).toContain('hidden');
    expect(white.className).toContain('dark:block');
  });

  it('white e black fixam a cor com uma única imagem', () => {
    const white = render(<Logo variant="white" />).container;
    expect(srcs(white)).toHaveLength(1);
    expect(srcs(white)[0]).toContain('logo-white.svg');
    const black = render(<Logo variant="black" />).container;
    expect(srcs(black)[0]).toContain('logo-black.svg');
  });
});
