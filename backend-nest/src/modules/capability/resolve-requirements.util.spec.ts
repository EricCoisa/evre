import { resolveRequirements } from './resolve-requirements.util';
import type { CapabilityRegistry } from './capability.registry';
import type { CapabilityStatus } from 'src/domain/capability/capability.types';

function registryWith(requirements: Record<string, string[]>): CapabilityRegistry {
  return {
    requirementsFor: (labelKey: string) => requirements[labelKey] ?? [],
  } as unknown as CapabilityRegistry;
}

describe('resolveRequirements', () => {
  it('sem requisito registrado devolve undefined', () => {
    const registry = registryWith({});
    expect(resolveRequirements('KEY', registry, {}, 'ADMIN')).toBeUndefined();
  });

  it('requisito saudável: hidden e disabled false, sem reason/capability', () => {
    const registry = registryWith({ KEY: ['A'] });
    const map: Record<string, CapabilityStatus> = { A: { available: true, operational: true } };
    expect(resolveRequirements('KEY', registry, map, 'ADMIN')).toEqual({
      hidden: false,
      disabled: false,
      reason: undefined,
      capability: undefined,
    });
  });

  it('available:false em alguma requerida esconde (hidden:true)', () => {
    const registry = registryWith({ KEY: ['A'] });
    const map: Record<string, CapabilityStatus> = { A: { available: false, operational: false } };
    expect(resolveRequirements('KEY', registry, map, 'ADMIN')!.hidden).toBe(true);
  });

  it('operational:false desabilita; ADMIN recebe reason', () => {
    const registry = registryWith({ KEY: ['A'] });
    const map: Record<string, CapabilityStatus> = {
      A: { available: true, operational: false, reason: 'provider caiu' },
    };
    const result = resolveRequirements('KEY', registry, map, 'ADMIN');
    expect(result).toEqual({
      hidden: false,
      disabled: true,
      reason: 'provider caiu',
      capability: 'A',
    });
  });

  it('não-ADMIN recebe disabled + capability, mas sem reason', () => {
    const registry = registryWith({ KEY: ['A'] });
    const map: Record<string, CapabilityStatus> = {
      A: { available: true, operational: false, reason: 'provider caiu' },
    };
    const result = resolveRequirements('KEY', registry, map, 'USER');
    expect(result).toEqual({
      hidden: false,
      disabled: true,
      reason: undefined,
      capability: 'A',
    });
  });

  it('com várias requeridas, capability/reason vêm da primeira que falhou', () => {
    const registry = registryWith({ KEY: ['A', 'B'] });
    const map: Record<string, CapabilityStatus> = {
      A: { available: true, operational: true },
      B: { available: true, operational: false, reason: 'B falhou' },
    };
    const result = resolveRequirements('KEY', registry, map, 'ADMIN');
    expect(result?.disabled).toBe(true);
    expect(result?.capability).toBe('B');
    expect(result?.reason).toBe('B falhou');
  });

  it('nome requerido ausente do capabilityMap degrada liberando (nunca quebra)', () => {
    const registry = registryWith({ KEY: ['GHOST'] });
    const result = resolveRequirements('KEY', registry, {}, 'ADMIN');
    expect(result).toEqual({
      hidden: false,
      disabled: false,
      reason: undefined,
      capability: undefined,
    });
  });
});
