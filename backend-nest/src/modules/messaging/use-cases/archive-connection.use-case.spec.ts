import { ArchiveConnectionUseCase } from './archive-connection.use-case';
import type { MessagingConnectionService } from '../messaging-connection.service';
import type { MessagingConnectionStateService } from '../messaging-connection-state.service';
import type { MessagingEventsService } from '../messaging-events.service';

describe('ArchiveConnectionUseCase', () => {
  const connection = { id: 'conn-1', archivedAt: null };
  const archived = { id: 'conn-1', archivedAt: new Date() };
  const connections = {
    get: vi.fn(),
    use: vi.fn(),
    archive: vi.fn(),
    view: vi.fn(),
  };
  const state = { reset: vi.fn() };
  const events = { emit: vi.fn() };
  let useCase: ArchiveConnectionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    connections.get.mockResolvedValue(connection);
    connections.archive.mockResolvedValue(archived);
    connections.view.mockReturnValue({ id: 'conn-1', archived: true });
    useCase = new ArchiveConnectionUseCase(
      connections as unknown as MessagingConnectionService,
      state as unknown as MessagingConnectionStateService,
      events as unknown as MessagingEventsService,
    );
  });

  it('arquiva antes e desliga o webhook, despareia e apaga a instância', async () => {
    const calls: string[] = [];
    connections.archive.mockImplementation(async () => {
      calls.push('archive');
      return archived;
    });
    const unregisterWebhook = vi.fn(async () => {
      calls.push('unregisterWebhook');
      return { status: true, data: 'ok' };
    });
    const disconnect = vi.fn(async () => {
      calls.push('disconnect');
      return { status: true, data: 'ok' };
    });
    const deleteInstance = vi.fn(async () => {
      calls.push('deleteInstance');
      return { status: true, data: 'ok' };
    });
    connections.use.mockReturnValue({
      unregisterWebhook,
      session: { disconnect },
      deleteInstance,
    });

    await useCase.execute('conn-1');

    expect(calls).toEqual([
      'archive',
      'unregisterWebhook',
      'disconnect',
      'deleteInstance',
    ]);
    expect(unregisterWebhook).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(deleteInstance).toHaveBeenCalled();
    expect(state.reset).toHaveBeenCalledWith('conn-1');
    expect(events.emit).toHaveBeenCalledWith({ type: 'connection' });
  });

  it('falha ao desligar o webhook não impede o arquivamento', async () => {
    const unregisterWebhook = vi
      .fn()
      .mockResolvedValue({ status: false, data: 'provider offline' });
    connections.use.mockReturnValue({ unregisterWebhook });

    await expect(useCase.execute('conn-1')).resolves.toBeDefined();
    expect(connections.archive).toHaveBeenCalledWith('conn-1');
    expect(state.reset).toHaveBeenCalledWith('conn-1');
  });

  it('provider sem deleteInstance (Evolution API, Meta) arquiva sem chamá-lo', async () => {
    connections.use.mockReturnValue({ session: undefined });

    await useCase.execute('conn-1');

    expect(connections.archive).toHaveBeenCalledWith('conn-1');
  });

  it('deleteInstance falhando (provider fora) não impede o arquivamento', async () => {
    const deleteInstance = vi.fn().mockRejectedValue(new Error('offline'));
    connections.use.mockReturnValue({ deleteInstance });

    await expect(useCase.execute('conn-1')).resolves.toBeDefined();
    expect(connections.archive).toHaveBeenCalledWith('conn-1');
  });

  it('deleteInstance devolvendo status:false também não impede o arquivamento', async () => {
    const deleteInstance = vi
      .fn()
      .mockResolvedValue({ status: false, data: 'instância não encontrada' });
    connections.use.mockReturnValue({ deleteInstance });

    await useCase.execute('conn-1');

    expect(connections.archive).toHaveBeenCalledWith('conn-1');
  });

  it('conexão já arquivada não chama o provider de novo', async () => {
    connections.get.mockResolvedValue(archived);

    await useCase.execute('conn-1');

    expect(connections.use).not.toHaveBeenCalled();
    expect(connections.archive).not.toHaveBeenCalled();
  });
});
