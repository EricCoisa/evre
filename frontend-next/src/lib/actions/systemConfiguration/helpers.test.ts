import { describe, it, expect } from 'vitest';
import { isConfigValuePresent } from './helpers';

describe('isConfigValuePresent', () => {
  it('retorna false para valores nulos, indefinidos ou vazios', () => {
    expect(isConfigValuePresent(null)).toBe(false);
    expect(isConfigValuePresent(undefined)).toBe(false);
    expect(isConfigValuePresent('')).toBe(false);
    expect(isConfigValuePresent('   ')).toBe(false);
  });

  it('retorna false para placeholders de seed conhecidos', () => {
    expect(isConfigValuePresent('sk-placeholder')).toBe(false);
    expect(isConfigValuePresent('sk-ant-placeholder')).toBe(false);
    expect(isConfigValuePresent('aaaaaaaa-bbbb-cccc-dddd-aaaaaaaaaaaa')).toBe(false);
    expect(isConfigValuePresent('smtp.example.com')).toBe(false);
    expect(isConfigValuePresent('user@example.com')).toBe(false);
    expect(isConfigValuePresent('pass123')).toBe(false);
    expect(isConfigValuePresent('minioadmin')).toBe(false);
    expect(isConfigValuePresent('http://localhost:8333')).toBe(false);
    expect(isConfigValuePresent('http://localhost:8333/template')).toBe(false);
  });

  it('retorna true para valores válidos ou segredos reais mascarados', () => {
    expect(isConfigValuePresent('****')).toBe(true);
    expect(isConfigValuePresent('sk-ant-api03-real-key-12345')).toBe(true);
    expect(isConfigValuePresent('smtp.gmail.com')).toBe(true);
    expect(isConfigValuePresent('my-bucket')).toBe(true);
  });
});

