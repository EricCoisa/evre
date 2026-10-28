import { parseByteRange } from './byte-range.util';

describe('parseByteRange', () => {
  it('sem header ou formato não suportado = conteúdo inteiro', () => {
    expect(parseByteRange(undefined, 100)).toBeNull();
    expect(parseByteRange('items=0-1', 100)).toBeNull();
    expect(parseByteRange('bytes=0-1,5-9', 100)).toBeNull();
    expect(parseByteRange('bytes=-', 100)).toBeNull();
  });

  it('intervalo fechado e aberto', () => {
    expect(parseByteRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseByteRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
  });

  it('limita o fim ao tamanho', () => {
    expect(parseByteRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
  });

  it('sufixo: últimos N bytes', () => {
    expect(parseByteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
  });

  it('início além do tamanho ou invertido é insatisfazível', () => {
    expect(parseByteRange('bytes=100-', 100)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=20-10', 100)).toBe('unsatisfiable');
  });
});
