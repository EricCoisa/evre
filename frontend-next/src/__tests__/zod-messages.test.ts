import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import i18n from '../../i18n';

/** Garante que o error map global do Zod continue traduzindo as mensagens de validação. */
const firstMessage = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues[0]?.message;

describe('mensagens de validação do Zod', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt-BR');
  });

  it('campo vazio não expõe notação técnica (>=1)', () => {
    const message = firstMessage(z.string().min(1), '');
    expect(message).toBe('Preencha este campo');
    expect(message).not.toContain('>=');
  });

  it('tamanho mínimo maior que 1 diz quantos caracteres, sem operador', () => {
    const message = firstMessage(z.string().min(8), 'abc');
    expect(message).toBe('Use pelo menos 8 caracteres');
    expect(message).not.toContain('>=');
  });

  it('tamanho máximo idem', () => {
    expect(firstMessage(z.string().max(5), 'abcdefgh')).toBe(
      'Use no máximo 5 caracteres',
    );
  });

  it('o resto continua com o locale do Zod, já traduzido', () => {
    expect(firstMessage(z.string().url(), 'x')).toBe('URL inválido');
  });

  it('acompanha a troca de idioma', async () => {
    await i18n.changeLanguage('en');
    expect(firstMessage(z.string().min(1), '')).toBe(
      'Please fill in this field',
    );
    await i18n.changeLanguage('pt-BR');
  });
});
