import { describe, expect, it } from 'vitest';
import { describeEffects, EFFECT_META, isKnownEffect } from './effects.meta';
import { EFFECT_REGISTRY } from './effects';

describe('EFFECT_META × EFFECT_REGISTRY', () => {
  it('todo efeito do catálogo tem componente registrado, e vice-versa', () => {
    const metaKeys = Object.keys(EFFECT_META).sort();
    const registryKeys = Object.keys(EFFECT_REGISTRY).sort();
    expect(registryKeys).toEqual(metaKeys);
  });
});

describe('isKnownEffect', () => {
  it('reconhece os tipos do catálogo', () => {
    expect(isKnownEffect('tilt3d')).toBe(true);
    expect(isKnownEffect('liquid-distortion')).toBe(true);
  });

  it('recusa tipo inventado', () => {
    expect(isKnownEffect('nuclear-explosion')).toBe(false);
  });
});

describe('describeEffects', () => {
  it('descreve cada efeito com type, label, description e params', () => {
    const result = describeEffects();

    expect(result).toHaveLength(Object.keys(EFFECT_META).length);

    const tilt = result.find((e) => e.type === 'tilt3d')!;
    expect(tilt.label).toBe(EFFECT_META.tilt3d.label);
    expect(tilt.params.map((p) => p.name)).toEqual(['rotateX', 'rotateY', 'perspective']);

    const liquid = result.find((e) => e.type === 'liquid-distortion')!;
    expect(liquid.params.map((p) => p.name)).toEqual(['strength', 'radius', 'torsion', 'chromatic']);
  });
});
