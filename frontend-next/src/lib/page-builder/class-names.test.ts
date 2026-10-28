import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { ALLOWED_CLASS_NAMES, filterClassName, innerAlignClass } from './class-names';

/** Compara `ALLOWED_CLASS_NAMES` com o safelist `@source inline(...)` do globals.css. */
function safelistedClasses(): Set<string> {
  const css = readFileSync(
    path.resolve(__dirname, '../../app/globals.css'),
    'utf-8',
  );
  const out = new Set<string>();
  for (const match of css.matchAll(/@source\s+inline\("([^"]+)"\)/g)) {
    for (const pattern of match[1].split(/\s+/)) {
      expandBraces(pattern).forEach((c) => out.add(c));
    }
  }
  return out;
}

/** `{p,px}-{2,4}` → p-2, p-4, px-2, px-4 (o Tailwind expande igual). */
function expandBraces(pattern: string): string[] {
  const match = /\{([^}]+)\}/.exec(pattern);
  if (!match) return [pattern];
  return match[1]
    .split(',')
    .flatMap((option) =>
      expandBraces(
        pattern.slice(0, match.index) + option + pattern.slice(match.index + match[0].length),
      ),
    );
}

describe('ALLOWED_CLASS_NAMES × @source inline', () => {
  const safelisted = safelistedClasses();

  it('o globals.css declara algum safelist', () => {
    expect(safelisted.size).toBeGreaterThan(0);
  });

  it('toda classe permitida é emitida pelo Tailwind', () => {
    const missing = ALLOWED_CLASS_NAMES.filter((c) => !safelisted.has(c));

    expect(missing).toEqual([]);
  });

  it('nenhuma classe safelistada está fora da lista permitida (CSS morto)', () => {
    const allowed = new Set<string>(ALLOWED_CLASS_NAMES);
    const dead = [...safelisted].filter((c) => !allowed.has(c));

    expect(dead).toEqual([]);
  });
});

describe('filterClassName', () => {
  it('mantém os tokens conhecidos', () => {
    expect(filterClassName('text-center font-bold')).toBe('text-center font-bold');
  });

  it('descarta token desconhecido em vez de quebrar a tela', () => {
    expect(filterClassName('text-center bg-red-500 rotate-45')).toBe('text-center');
  });

  it('devolve undefined quando não sobra nada de válido', () => {
    expect(filterClassName('bg-red-500')).toBeUndefined();
    expect(filterClassName('')).toBeUndefined();
    expect(filterClassName(42)).toBeUndefined();
  });

  it('não deixa passar classe arbitrária da paleta bruta', () => {
    // Cor solta quebraria tema claro/escuro — só tokens semânticos entram.
    expect(filterClassName('bg-blue-600 text-white')).toBeUndefined();
  });
});

describe('innerAlignClass', () => {
  it('traduz items-center para text-center', () => {
    expect(innerAlignClass('items-center')).toBe('text-center');
  });

  it('acha o token no meio de outras classes', () => {
    expect(innerAlignClass('p-4 items-end gap-2')).toBe('text-right');
  });

  it('items-start vira text-left', () => {
    expect(innerAlignClass('items-start')).toBe('text-left');
  });

  it('sem token de alinhamento devolve undefined', () => {
    expect(innerAlignClass('p-4 gap-2')).toBeUndefined();
  });

  it('não confunde justify-center com items-center', () => {
    expect(innerAlignClass('justify-center')).toBeUndefined();
  });

  it('ignora valor que não é string', () => {
    expect(innerAlignClass(undefined)).toBeUndefined();
  });
});
