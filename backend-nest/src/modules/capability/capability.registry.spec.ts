import { CapabilityRegistry } from './capability.registry';
import type { FeatureFlagService } from '../feature-flag/feature-flag.service';
import type { I18nService } from 'nestjs-i18n';

const mockFeatureFlags = { isEnabled: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };

function makeRegistry(): CapabilityRegistry {
  return new CapabilityRegistry(
    mockFeatureFlags as unknown as FeatureFlagService,
    mockI18n as unknown as I18nService,
  );
}

describe('CapabilityRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.isEnabled.mockResolvedValue(true);
  });

  it('nome não registrado degrada liberando, nunca lança', async () => {
    const registry = makeRegistry();
    await expect(registry.resolve('UNKNOWN', 'ADMIN')).resolves.toEqual({
      available: true,
      operational: true,
    });
  });

  it('check que lança não propaga a exceção — operational:false', async () => {
    const registry = makeRegistry();
    registry.register('BROKEN', {
      flags: [],
      check: () => Promise.reject(new Error('boom')),
    });
    const status = await registry.resolve('BROKEN', 'ADMIN');
    expect(status.operational).toBe(false);
    expect(status.reason).toBe('boom');
  });

  it('check que estoura 2000ms vira operational:false', async () => {
    vi.useFakeTimers();
    try {
      const registry = makeRegistry();
      registry.register('SLOW', {
        flags: [],
        check: () => new Promise(() => {}), // nunca resolve
      });
      const pending = registry.resolve('SLOW', 'ADMIN');
      await vi.advanceTimersByTimeAsync(2001);
      const status = await pending;
      expect(status.operational).toBe(false);
      expect(status.available).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flag própria OFF esconde sem rodar o check', async () => {
    const registry = makeRegistry();
    mockFeatureFlags.isEnabled.mockResolvedValue(false);
    const check = vi.fn().mockResolvedValue({ operational: true });
    registry.register('GATED', { flags: ['SOME_FLAG'], check });
    const status = await registry.resolve('GATED', 'ADMIN');
    expect(status).toEqual({ available: false, operational: false });
    expect(check).not.toHaveBeenCalled();
  });

  it('composto delega a um interno operacional e herda o estado', async () => {
    const registry = makeRegistry();
    registry.register('B', { flags: [], check: async () => ({ operational: true }) });
    registry.register('A', { flags: [], check: ({ resolve }) => resolve('B') });
    const status = await registry.resolve('A', 'ADMIN');
    expect(status).toEqual({ available: true, operational: true, reason: undefined });
  });

  it('flag do recurso INTERNO off esconde o composto (available:false), não desabilita', async () => {
    const registry = makeRegistry();
    mockFeatureFlags.isEnabled.mockImplementation((flag: string) =>
      Promise.resolve(flag !== 'B_FLAG'),
    );
    registry.register('B', { flags: ['B_FLAG'], check: async () => ({ operational: true }) });
    registry.register('A', { flags: [], check: ({ resolve }) => resolve('B') });
    const status = await registry.resolve('A', 'ADMIN');
    expect(status.available).toBe(false);
  });

  it('register() do mesmo nome duas vezes lança', () => {
    const registry = makeRegistry();
    registry.register('DUP', { flags: [], check: async () => ({ operational: true }) });
    expect(() =>
      registry.register('DUP', { flags: [], check: async () => ({ operational: true }) }),
    ).toThrow('Capability duplicada: DUP');
  });

  it('ciclo A→B→A corta em depth 5 e não trava', async () => {
    const registry = makeRegistry();
    registry.register('A', { flags: [], check: ({ resolve }) => resolve('B') });
    registry.register('B', { flags: [], check: ({ resolve }) => resolve('A') });
    const status = await registry.resolve('A', 'ADMIN');
    expect(status.available).toBe(false);
    expect(status.operational).toBe(false);
    expect(status.reason).toBe('capability.max_depth');
  });

  it('requires()/requirementsFor() casam chave exata; chave desconhecida vira []', () => {
    const registry = makeRegistry();
    registry.requires('SOME_KEY', ['A', 'B']);
    expect(registry.requirementsFor('SOME_KEY')).toEqual(['A', 'B']);
    expect(registry.requirementsFor('UNKNOWN_KEY')).toEqual([]);
  });
});
