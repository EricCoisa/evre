import { VerificationHandlerRegistry } from './verification-handler.registry';

describe('VerificationHandlerRegistry', () => {
  let registry: VerificationHandlerRegistry;

  beforeEach(() => {
    registry = new VerificationHandlerRegistry();
  });

  it('invoke() é no-op quando nada foi registrado para o purpose', async () => {
    await expect(
      registry.invoke('NOBODY_REGISTERED', { userId: 'u1', target: 'x' }),
    ).resolves.toBeUndefined();
  });

  it('invoca o handler registrado com o contexto certo', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register('P', handler);

    await registry.invoke('P', { userId: 'u1', target: '+5511999998888' });

    expect(handler).toHaveBeenCalledWith({
      userId: 'u1',
      target: '+5511999998888',
    });
  });

  it('invoca todos os handlers registrados para o mesmo purpose', async () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    registry.register('P', first);
    registry.register('P', second);

    await registry.invoke('P', { userId: 'u1', target: 'x' });

    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('não invoca handler de outro purpose', async () => {
    const handler = vi.fn();
    registry.register('OTHER_PURPOSE', handler);

    await registry.invoke('P', { userId: 'u1', target: 'x' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('register() devolve uma função que remove o handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const unregister = registry.register('P', handler);

    unregister();
    await registry.invoke('P', { userId: 'u1', target: 'x' });

    expect(handler).not.toHaveBeenCalled();
  });
});
