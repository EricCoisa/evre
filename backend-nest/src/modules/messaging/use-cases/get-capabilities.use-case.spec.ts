import { GetCapabilitiesUseCase } from './get-capabilities.use-case';
import type { MessagingConnectionService } from '../messaging-connection.service';
import type { MessagingConnectionStateService } from '../messaging-connection-state.service';

describe('GetCapabilitiesUseCase', () => {
  it('devolve as capabilities do provider da conexão pedida', async () => {
    const connection = { id: 'conn-1', provider: 'EVOLUTION_API' };
    const expected = {
      provider: 'EVOLUTION_API',
      connectionId: 'conn-1',
      messageTypes: ['TEXT', 'DOCUMENT', 'IMAGE'],
      template: {
        approval: false,
        providerOwnedBody: [],
        components: { header: [], footer: false, buttons: [] },
      },
      voiceRecording: true,
    };
    const connections = { get: vi.fn().mockResolvedValue(connection) };
    const state = { capabilities: vi.fn().mockReturnValue(expected) };
    const useCase = new GetCapabilitiesUseCase(
      connections as unknown as MessagingConnectionService,
      state as unknown as MessagingConnectionStateService,
    );

    expect(await useCase.execute('conn-1')).toEqual(expected);
    expect(connections.get).toHaveBeenCalledWith('conn-1');
    expect(state.capabilities).toHaveBeenCalledWith(connection);
  });
});
