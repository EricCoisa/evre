import { describe, expect, it } from 'vitest';
import {
  buildMotionProps,
  DEFAULT_DELAY,
  DEFAULT_DURATION,
  MAX_DELAY,
  MAX_DURATION,
  MIN_DELAY,
  MIN_DURATION,
  resolveAnimation,
} from './animation';

describe('resolveAnimation', () => {
  it('cai no default (none/load/none) sem bloco nem padrão de página', () => {
    expect(resolveAnimation(undefined, undefined)).toEqual({
      entrance: 'none',
      trigger: 'load',
      hover: 'none',
      duration: DEFAULT_DURATION,
      delay: DEFAULT_DELAY,
    });
  });

  it('herda o padrão da página quando o bloco não tem animação própria', () => {
    const layout = { entrance: 'fade', hover: 'lift' } as const;
    expect(resolveAnimation(undefined, layout)).toMatchObject({ entrance: 'fade', hover: 'lift' });
  });

  it('o bloco vence campo a campo, mantendo o resto herdado da página', () => {
    const layout = { entrance: 'fade', hover: 'lift', duration: 0.6 } as const;
    const block = { hover: 'glow' } as const;
    expect(resolveAnimation(block, layout)).toMatchObject({
      entrance: 'fade',
      hover: 'glow',
      duration: 0.6,
    });
  });

  it('satura duration/delay nos limites em vez de aceitar valor fora da faixa', () => {
    const resolved = resolveAnimation({ duration: 99, delay: -5 }, undefined);
    expect(resolved.duration).toBe(MAX_DURATION);
    expect(resolved.delay).toBe(MIN_DELAY);
    expect(resolveAnimation({ duration: 0 }, undefined).duration).toBe(MIN_DURATION);
    expect(resolveAnimation({ delay: 99 }, undefined).delay).toBe(MAX_DELAY);
  });
});

describe('buildMotionProps', () => {
  it('sem entrada e sem hover não gera nenhuma prop de movimento', () => {
    expect(buildMotionProps(resolveAnimation(undefined, undefined))).toEqual({});
  });

  it('entrada "load" anima uma vez via initial/animate, sem whileInView', () => {
    const props = buildMotionProps(resolveAnimation({ entrance: 'fade', trigger: 'load' }, undefined));
    expect(props.initial).toEqual({ opacity: 0 });
    expect(props.animate).toEqual({ opacity: 1 });
    expect(props.whileInView).toBeUndefined();
  });

  it('entrada "scroll" usa whileInView com viewport once:false (entra e sai)', () => {
    const props = buildMotionProps(
      resolveAnimation({ entrance: 'slide-up', trigger: 'scroll' }, undefined),
    );
    expect(props.whileInView).toEqual({ opacity: 1, y: 0 });
    expect(props.viewport).toEqual({ once: false, amount: 0.3 });
    expect(props.animate).toBeUndefined();
  });

  it('hover sozinho (sem entrada) só define whileHover', () => {
    const props = buildMotionProps(resolveAnimation({ hover: 'scale' }, undefined));
    expect(props).toEqual({ whileHover: { scale: 1.02 }, transition: { duration: DEFAULT_DURATION, delay: DEFAULT_DELAY } });
  });

  it('prefers-reduced-motion remove transform/scroll e mantém só opacidade no hover', () => {
    const props = buildMotionProps(
      resolveAnimation({ entrance: 'zoom-in', trigger: 'scroll', hover: 'lift' }, undefined),
      true,
    );
    expect(props.initial).toBeUndefined();
    expect(props.whileInView).toBeUndefined();
    expect(props.whileHover).toEqual({ opacity: 0.92 });
  });

  it('prefers-reduced-motion sem hover não gera nenhuma prop', () => {
    const props = buildMotionProps(resolveAnimation({ entrance: 'fade' }, undefined), true);
    expect(props).toEqual({});
  });
});
