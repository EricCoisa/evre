import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('texto sem link volta inteiro', () => {
    expect(linkify('oi tudo bem?')).toEqual([{ text: 'oi tudo bem?' }]);
  });

  it('isola a URL e não leva a pontuação final junto', () => {
    expect(linkify('veja https://exemplo.com/a?b=1, depois')).toEqual([
      { text: 'veja ' },
      { text: 'https://exemplo.com/a?b=1', href: 'https://exemplo.com/a?b=1' },
      { text: ', depois' },
    ]);
  });

  it('só http(s): javascript: não vira link', () => {
    expect(linkify('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }]);
  });

  it('várias URLs', () => {
    expect(linkify('http://a.com http://b.com').filter((p) => p.href)).toHaveLength(2);
  });
});
