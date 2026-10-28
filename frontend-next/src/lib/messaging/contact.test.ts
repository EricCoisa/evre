import { describe, expect, it } from 'vitest';
import { contactDisplayName, contactInitials, contactPhotoSrc } from './contact';

describe('contactDisplayName', () => {
  it('prefere o nome do operador, depois o do WhatsApp, depois o número', () => {
    expect(contactDisplayName({ phone: '5534', name: 'Maria', pushName: 'Mari' })).toBe('Maria');
    expect(contactDisplayName({ phone: '5534', name: null, pushName: 'Mari' })).toBe('Mari');
    expect(contactDisplayName({ phone: '5534', name: '', pushName: null })).toBe('5534');
    expect(contactDisplayName({ phone: '5534' })).toBe('5534');
  });
});

describe('contactInitials', () => {
  it.each([
    ['Maria Silva', 'MS'],
    ['maria', 'M'],
    ['  João   Pedro  da Silva ', 'JP'],
    ['álvaro', 'Á'],
    ['😀 Ana', 'A'],
  ])('%s → %s', (name, expected) => expect(contactInitials(name)).toBe(expected));

  it('sem letra devolve null para a tela usar o ícone', () => {
    expect(contactInitials('5534998956461')).toBeNull();
    expect(contactInitials('')).toBeNull();
    expect(contactInitials(null)).toBeNull();
    expect(contactInitials(undefined)).toBeNull();
  });
});

describe('contactPhotoSrc', () => {
  it('aponta para o proxy do front e codifica o telefone', () => {
    expect(contactPhotoSrc('5534998956461')).toBe('/api/messaging/contacts/5534998956461/photo');
    expect(contactPhotoSrc('+55 34')).toBe('/api/messaging/contacts/%2B55%2034/photo');
  });
});
