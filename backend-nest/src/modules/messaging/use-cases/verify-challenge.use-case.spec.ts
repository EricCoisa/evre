import { VerifyWebhookChallengeUseCase } from './verify-challenge.use-case';

describe('VerifyWebhookChallengeUseCase', () => {
  const conn = { id: 'c1', provider: 'META' };
  const adapter = { verifyChallenge: vi.fn() };
  const messaging = { webhookKey: vi.fn() };
  const connections = { get: vi.fn(), list: vi.fn(), use: vi.fn() };
  let useCase: VerifyWebhookChallengeUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    messaging.webhookKey.mockResolvedValue('k');
    connections.get.mockResolvedValue(conn);
    connections.list.mockResolvedValue([conn]);
    connections.use.mockReturnValue(adapter);
    adapter.verifyChallenge.mockReturnValue('desafio');
    useCase = new VerifyWebhookChallengeUseCase(
      messaging as never,
      connections as never,
    );
  });

  it('chave certa devolve o desafio do provider', async () => {
    await expect(useCase.execute({ key: 'k', connection: 'c1' })).resolves.toBe(
      'desafio',
    );
  });

  it('chave errada ou ausente é recusada', async () => {
    await expect(
      useCase.execute({ key: 'x', connection: 'c1' }),
    ).resolves.toBeNull();
    await expect(useCase.execute({ connection: 'c1' })).resolves.toBeNull();
  });

  it.each([null, ''])(
    'sem chave configurada (%j) recusa tudo (falha fechada)',
    async (configured) => {
      messaging.webhookKey.mockResolvedValue(configured);
      await expect(useCase.execute({ connection: 'c1' })).resolves.toBeNull();
      await expect(
        useCase.execute({ key: '', connection: 'c1' }),
      ).resolves.toBeNull();
      expect(adapter.verifyChallenge).not.toHaveBeenCalled();
    },
  );

  it('conexão desconhecida é recusada', async () => {
    connections.get.mockRejectedValue(new Error('nope'));
    await expect(
      useCase.execute({ key: 'k', connection: 'zzz' }),
    ).resolves.toBeNull();
  });

  it('desafio que o provider recusa (lança) vira recusa', async () => {
    adapter.verifyChallenge.mockImplementation(() => {
      throw new Error('token');
    });
    await expect(
      useCase.execute({ key: 'k', connection: 'c1' }),
    ).resolves.toBeNull();
  });
});
