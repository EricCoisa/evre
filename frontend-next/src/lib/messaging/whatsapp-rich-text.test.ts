import { describe, expect, it } from 'vitest';
import { serializeWhatsAppText } from './whatsapp-rich-text';

describe('serializeWhatsAppText', () => {
  it('leaves spaces between differently formatted words unformatted', () => {
    const message =
      serializeWhatsAppText('teste ', 'bold') +
      serializeWhatsAppText('Teste', 'italic') +
      serializeWhatsAppText(' Teste ', 'italic') +
      serializeWhatsAppText('Teste', null);

    expect(message).toBe('*teste* _Teste_ _Teste_ Teste');
  });

  it('keeps every whitespace run outside formatting markers', () => {
    expect(serializeWhatsAppText('one two\nthree', 'bold')).toBe('*one* *two*\n*three*');
  });

  it('leaves unformatted text unchanged', () => {
    expect(serializeWhatsAppText('one two', null)).toBe('one two');
  });
});
