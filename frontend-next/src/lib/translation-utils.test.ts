import { describe, it, expect } from 'vitest';
import { isLabelKey, applyParams, getTranslationFromJson } from './translation-utils';

describe('isLabelKey', () => {
  it('matches all-caps/underscore keys', () => {
    expect(isLabelKey('FOO_BAR')).toBe(true);
  });

  it('rejects lowercase, mixed-case, or empty strings', () => {
    expect(isLabelKey('fooBar')).toBe(false);
    expect(isLabelKey('Foo_Bar')).toBe(false);
    expect(isLabelKey('')).toBe(false);
  });
});

describe('applyParams', () => {
  it('returns the text unchanged when there are no params', () => {
    expect(applyParams('hello {name}')).toBe('hello {name}');
  });

  it('substitutes every matching placeholder', () => {
    expect(applyParams('hello {name}, you have {count} items', { name: 'Ana', count: 3 })).toBe(
      'hello Ana, you have 3 items',
    );
  });

  it('leaves placeholders without a matching param untouched', () => {
    expect(applyParams('hello {name}', { other: 'x' })).toBe('hello {name}');
  });
});

describe('getTranslationFromJson', () => {
  it('throws when no fetcher is provided', async () => {
    await expect(getTranslationFromJson('en', 'common')).rejects.toThrow('fetcher is required');
  });

  it('returns the primary-locale data when the fetcher resolves it', async () => {
    const fetcher = async (path: string) =>
      path === '/locales/en/common.json' ? { hello: 'hi' } : {};

    await expect(getTranslationFromJson('en', 'common', 'pt-BR', fetcher)).resolves.toEqual({ hello: 'hi' });
  });

  it('falls back to the fallback locale when the primary fetch throws', async () => {
    const fetcher = async (path: string) => {
      if (path === '/locales/en/common.json') throw new Error('404');
      return { ola: 'oi' };
    };

    await expect(getTranslationFromJson('en', 'common', 'pt-BR', fetcher)).resolves.toEqual({ ola: 'oi' });
  });

  it('falls back to the fallback locale when the primary fetch resolves falsy', async () => {
    const fetcher = async (path: string) =>
      path === '/locales/pt-BR/common.json' ? { ola: 'oi' } : (undefined as never);

    await expect(getTranslationFromJson('en', 'common', 'pt-BR', fetcher)).resolves.toEqual({ ola: 'oi' });
  });

  it('returns an empty object when both the primary and fallback fetch fail', async () => {
    const fetcher = async () => {
      throw new Error('down');
    };

    await expect(getTranslationFromJson('en', 'common', 'pt-BR', fetcher)).resolves.toEqual({});
  });
});
