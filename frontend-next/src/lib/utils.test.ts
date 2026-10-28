import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getQueryConfig,
  getIcon,
  formatDate,
  isUUID,
  isDevelopment,
  setLang,
  GetNestedValue,
  GetNestedValueArray,
} from './utils';
import i18n from '../../i18n';
import { LayoutDashboard, Rocket } from 'lucide-react';

describe('getQueryConfig', () => {
  it('builds react-query defaults from the named cache/gc buckets', () => {
    const config = getQueryConfig('USERS', 'USER_PROFILE');

    expect(config.refetchOnMount).toBe(false);
    expect(config.refetchOnWindowFocus).toBe(false);
    expect(config.staleTime).toBeGreaterThan(0);
    expect(config.gcTime).toBeGreaterThan(0);
  });

  it('falls back to the DEFAULT gc bucket when none is given', () => {
    const config = getQueryConfig('USERS');
    const withDefault = getQueryConfig('USERS', 'DEFAULT');

    expect(config.gcTime).toBe(withDefault.gcTime);
  });
});

describe('getIcon', () => {
  it('returns LayoutDashboard when no icon name is given', () => {
    expect(getIcon()).toBe(LayoutDashboard);
    expect(getIcon(null)).toBe(LayoutDashboard);
  });

  it('resolves a kebab-case name to its PascalCase lucide icon', () => {
    expect(getIcon('rocket')).toBe(Rocket);
  });

  it('falls back to LayoutDashboard for an unknown icon name', () => {
    expect(getIcon('not-a-real-icon-xyz')).toBe(LayoutDashboard);
  });
});

describe('formatDate', () => {
  it('formats a valid date string using pt-BR locale rules', () => {
    expect(formatDate('2024-01-15T00:00:00Z')).not.toBe('2024-01-15T00:00:00Z');
  });

  it('returns the original string when toLocaleString throws', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(() => {
      throw new Error('nope');
    });

    expect(formatDate('2024-01-15')).toBe('2024-01-15');

    spy.mockRestore();
  });
});

describe('isUUID', () => {
  it('matches a well-formed UUID', () => {
    expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isUUID('not-a-uuid')).toBe(false);
  });
});

describe('isDevelopment', () => {
  const original = process.env.NEXT_PUBLIC_ENV;
  afterEach(() => {
    process.env.NEXT_PUBLIC_ENV = original;
  });

  it('is true only when NEXT_PUBLIC_ENV is "development"', () => {
    process.env.NEXT_PUBLIC_ENV = 'development';
    expect(isDevelopment()).toBe(true);

    process.env.NEXT_PUBLIC_ENV = 'production';
    expect(isDevelopment()).toBe(false);
  });
});

describe('setLang', () => {
  it('persists the language to localStorage, the cookie, and i18next', () => {
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage').mockImplementation(() => Promise.resolve(i18n.t));

    setLang('en');

    expect(localStorage.getItem('i18nextLng')).toBe('en');
    expect(document.cookie).toContain('i18nextLng=en');
    expect(changeLanguage).toHaveBeenCalledWith('en');
  });
});

describe('GetNestedValue / GetNestedValueArray', () => {
  const obj = { a: { b: { c: 'deep' } }, x: 'top' };

  it('reads a dotted path', () => {
    expect(GetNestedValue('a.b.c', obj)).toBe('deep');
    expect(GetNestedValue('x', obj)).toBe('top');
  });

  it('returns undefined for a missing path', () => {
    expect(GetNestedValue('a.b.missing', obj)).toBeUndefined();
  });

  it('joins several resolved paths with a leading space each', () => {
    expect(GetNestedValueArray(['x', 'a.b.c'], obj)).toBe(' top deep');
  });
});
