import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RevokeApiKeyUseCase } from './revoke-api-key.use-case';

const mockPrisma = {
  apiKey: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
};
const mockI18n = { t: vi.fn((k: string) => k) };
const mockLoggingService = { create: vi.fn() };

describe('RevokeApiKeyUseCase', () => {
  let useCase: RevokeApiKeyUseCase;

  const key = { id: 'k1', name: 'Minha chave', userId: 'u1' };

  beforeEach(() => {
    useCase = new RevokeApiKeyUseCase(
      mockPrisma as never,
      mockI18n as never,
      mockLoggingService as never,
    );
    vi.clearAllMocks();
    mockPrisma.apiKey.findUnique.mockResolvedValue(key);
    mockPrisma.apiKey.delete.mockResolvedValue(key);
  });

  it('revoga chave própria sem admin', async () => {
    const result = await useCase.execute('k1', 'u1', false);

    expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({ where: { id: 'k1' } });
    expect(result).toEqual({ id: 'k1', revoked: true });
  });

  it('admin revoga chave de qualquer usuário', async () => {
    await expect(useCase.execute('k1', 'admin1', true)).resolves.toEqual({
      id: 'k1',
      revoked: true,
    });
  });

  it('lança NotFound quando a chave não existe', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(null);

    await expect(useCase.execute('k0', 'u1', false)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.apiKey.delete).not.toHaveBeenCalled();
  });

  it('lança Forbidden quando não-admin tenta revogar chave alheia', async () => {
    await expect(useCase.execute('k1', 'u2', false)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockPrisma.apiKey.delete).not.toHaveBeenCalled();
  });

  it('registra log de revogação', async () => {
    await useCase.execute('k1', 'u1', false);

    expect(mockLoggingService.create).toHaveBeenCalledWith(
      {
        module: 'API_KEY',
        action: 'API_KEY_REVOKED',
        message: 'API key revogada: Minha chave',
        metadata: { apiKeyId: 'k1' },
      },
      'u1',
    );
  });
});
