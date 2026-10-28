import { describe, it, expect } from 'vitest';
import { dropId, parseDropId } from './block-chrome';

describe('dropId / parseDropId', () => {
  it('ida e volta preserva zona e bloco', () => {
    expect(parseDropId(dropId('inside', 'abc'))).toEqual({ placement: 'inside', blockId: 'abc' });
    expect(parseDropId(dropId('swap', 'abc'))).toEqual({ placement: 'swap', blockId: 'abc' });
  });

  it('id de bloco cru não é zona — soltar no corpo não move', () => {
    expect(parseDropId('stat.card-f68728')).toBeNull();
  });

  it('zona desconhecida é recusada', () => {
    expect(parseDropId('sideways::abc')).toBeNull();
  });

  it('aceita id de bloco com hífen e ponto', () => {
    expect(parseDropId(dropId('after', 'table.basic-9f2a'))).toEqual({
      placement: 'after',
      blockId: 'table.basic-9f2a',
    });
  });
});
