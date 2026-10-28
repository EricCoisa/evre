import { CreateApiKeyUseCase } from './create-api-key.use-case';

const mockPrisma = {
  apiKey: { create: vi.fn() },
};
const mockApiKeyService = {
  generate: vi.fn(),
  hash: vi.fn(),
};
const mockLoggingService = {
  create: vi.fn(),
};

describe('CreateApiKeyUseCase', () => {
  let useCase: CreateApiKeyUseCase;

  beforeEach(() => {
    useCase = new CreateApiKeyUseCase(
      mockPrisma as never,
      mockApiKeyService as never,
      mockLoggingService as never,
    );
    vi.clearAllMocks();
    mockApiKeyService.generate.mockReturnValue('ak_rawsecret123');
    mockApiKeyService.hash.mockReturnValue('hash_of_rawsecret');
    mockPrisma.apiKey.create.mockResolvedValue({
      id: 'k1',
      name: 'Minha chave',
      keyPrefix: 'ak_rawsecret',
      keyHash: 'hash_of_rawsecret',
      scopes: ['users:read'],
      createdAt: new Date('2027-01-01T00:00:00.000Z'),
      userId: 'u1',
    });
    mockLoggingService.create.mockResolvedValue(undefined);
  });

  it('persiste apenas o hash — nunca a chave crua', async () => {
    await useCase.execute(
      { name: 'Minha chave', scopes: ['users:read'] },
      'u1',
    );

    expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
      data: {
        name: 'Minha chave',
        keyHash: 'hash_of_rawsecret',
        keyPrefix: 'ak_rawsecret',
        scopes: ['users:read'],
        userId: 'u1',
        expiresAt: null,
      },
    });
    // A chave crua não pode vazar para o banco.
    const data = mockPrisma.apiKey.create.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain('ak_rawsecret123');
  });

  it('retorna rawKey exatamente UMA vez na resposta', async () => {
    const result = await useCase.execute(
      { name: 'Minha chave', scopes: ['users:read'] },
      'u1',
    );

    expect(result.rawKey).toBe('ak_rawsecret123');
    expect(result).toEqual({
      id: 'k1',
      name: 'Minha chave',
      keyPrefix: 'ak_rawsecret',
      scopes: ['users:read'],
      createdAt: expect.any(Date),
      rawKey: 'ak_rawsecret123',
    });
  });

  it('registra log de criação com metadados', async () => {
    await useCase.execute(
      { name: 'Minha chave', scopes: ['users:read'] },
      'u1',
    );

    expect(mockLoggingService.create).toHaveBeenCalledWith(
      {
        module: 'API_KEY',
        action: 'API_KEY_CREATED',
        message: 'API key criada: Minha chave',
        metadata: { apiKeyId: 'k1', scopes: ['users:read'] },
      },
      'u1',
    );
  });

  it('propaga expiresAt quando informado', async () => {
    const expiresAt = new Date('2027-06-01T00:00:00.000Z');
    await useCase.execute(
      { name: 'Chave temporária', scopes: ['agent:chat'], expiresAt },
      'u1',
    );

    expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ expiresAt }),
    });
  });
});
