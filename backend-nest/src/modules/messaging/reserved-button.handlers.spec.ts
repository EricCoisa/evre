import { ReservedButtonHandlers } from './reserved-button.handlers';
import { ButtonHandlerRegistry } from './button-handler.registry';

describe('ReservedButtonHandlers', () => {
  const prisma = { messagingContact: { updateMany: vi.fn() } };
  const events = { emit: vi.fn() };
  let registry: ButtonHandlerRegistry;

  const event = { phone: '5511999999999' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ButtonHandlerRegistry();
    new ReservedButtonHandlers(registry, prisma as never, events as never).onModuleInit();
  });

  it('opt_out vale para qualquer tipo de template', () => {
    expect(registry.handlersFor('QUALQUER', 'opt_out')).toHaveLength(1);
    expect(registry.handlersFor(null, 'opt_out')).toHaveLength(1);
  });

  it('opt_out marca o contato e avisa as telas; repetido não regrava', async () => {
    prisma.messagingContact.updateMany.mockResolvedValueOnce({ count: 1 });
    const [handler] = registry.handlersFor('X', 'opt_out');
    await handler(event);

    expect(prisma.messagingContact.updateMany).toHaveBeenCalledWith({
      where: { phone: '5511999999999', optOut: false },
      data: { optOut: true, optOutAt: expect.any(Date) },
    });
    expect(events.emit).toHaveBeenCalledWith({ type: 'contacts' });

    prisma.messagingContact.updateMany.mockResolvedValueOnce({ count: 0 });
    events.emit.mockClear();
    await handler(event);
    expect(events.emit).not.toHaveBeenCalled();
  });
});
