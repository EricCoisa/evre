import { BadRequestException } from '@nestjs/common';
import type { I18nService } from 'nestjs-i18n';
import { convertValueByType, validateValueType } from './conversor.util';

const mockI18n = {
  t: vi.fn((key: string) => key),
} as unknown as I18nService<Record<string, unknown>>;

describe('validateValueType', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not throw for a valid number string', () => {
    expect(() => validateValueType('42', 'number', mockI18n)).not.toThrow();
  });

  it('throws BadRequestException for a non-numeric string with type number', () => {
    expect(() => validateValueType('abc', 'number', mockI18n)).toThrow(
      BadRequestException,
    );
  });

  it('does not throw for "true" with boolean type', () => {
    expect(() => validateValueType('true', 'boolean', mockI18n)).not.toThrow();
  });

  it('does not throw for "false" with boolean type', () => {
    expect(() => validateValueType('false', 'boolean', mockI18n)).not.toThrow();
  });

  it('throws BadRequestException for an invalid boolean string', () => {
    expect(() => validateValueType('yes', 'boolean', mockI18n)).toThrow(
      BadRequestException,
    );
  });

  it('does not throw for valid JSON with json type', () => {
    expect(() =>
      validateValueType('{"key":"value"}', 'json', mockI18n),
    ).not.toThrow();
  });

  it('throws BadRequestException for invalid JSON', () => {
    expect(() => validateValueType('{invalid}', 'json', mockI18n)).toThrow(
      BadRequestException,
    );
  });

  it('does not throw for string type (no validation performed)', () => {
    expect(() =>
      validateValueType('anything', 'string', mockI18n),
    ).not.toThrow();
  });
});

describe('convertValueByType', () => {
  it('returns null when value is null', () => {
    expect(convertValueByType(null, 'number')).toBeNull();
  });

  it('returns undefined when value is undefined', () => {
    expect(convertValueByType(undefined, 'number')).toBeUndefined();
  });

  it('converts string to number', () => {
    expect(convertValueByType('42', 'number')).toBe(42);
  });

  it('converts string "true" to boolean true', () => {
    expect(convertValueByType('true', 'boolean')).toBe(true);
  });

  it('converts actual boolean true to true', () => {
    expect(convertValueByType(true, 'boolean')).toBe(true);
  });

  it('converts string "false" to boolean false', () => {
    expect(convertValueByType('false', 'boolean')).toBe(false);
  });

  it('parses JSON string to object for json type', () => {
    expect(convertValueByType('{"a":1}', 'json')).toEqual({ a: 1 });
  });

  it('returns an already-object value as-is for json type', () => {
    const obj = { a: 1 };
    expect(convertValueByType(obj, 'json')).toBe(obj);
  });

  it('returns original string when JSON parse fails for json type', () => {
    expect(convertValueByType('{invalid}', 'json')).toBe('{invalid}');
  });

  it('returns value as-is for default (string) type', () => {
    expect(convertValueByType('hello', 'string')).toBe('hello');
  });
});
