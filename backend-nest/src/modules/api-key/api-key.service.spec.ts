import { ApiKeyService } from './api-key.service';

const mockPrisma = {
  apiKey: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(() => {
    service = new ApiKeyService(mockPrisma as never);
    vi.clearAllMocks();
    mockPrisma.apiKey.update.mockResolvedValue({});
  });

  describe('generate', () => {
    it('gera chave com prefixo ak_ e 32 bytes base64url', () => {
      const raw = service.generate();
      expect(raw.startsWith('ak_')).toBe(true);
      expect(raw.length).toBeGreaterThan(10);
    });

    it('gera chaves únicas', () => {
      const a = service.generate();
      const b = service.generate();
      expect(a).not.toBe(b);
    });
  });

  describe('hash', () => {
    it('produz hash SHA-256 hex determinístico', () => {
      const h1 = service.hash('ak_test');
      const h2 = service.hash('ak_test');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
      expect(h1).not.toContain('ak_test');
    });
  });

  describe('validateKey', () => {
    const baseKey = {
      id: 'k1',
      expiresAt: null,
      scopes: ['users:read'],
      user: {
        id: 'u1',
        email: 'a@b.com',
        status: 'ACTIVE',
        deletedAt: null,
        roleId: null,
        roleRecord: { name: 'USER' },
      },
    };

    it('retorna usuário e scopes para chave válida', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(baseKey);

      const result = await service.validateKey('ak_valid');

      expect(result).toEqual({ user: baseKey.user, scopes: ['users:read'] });
      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: service.hash('ak_valid') },
        include: {
          user: { include: { roleRecord: { select: { name: true } } } },
        },
      });
    });

    it('atualiza lastUsedAt de forma best-effort', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(baseKey);
      mockPrisma.apiKey.update.mockRejectedValue(new Error('boom'));

      await expect(service.validateKey('ak_valid')).resolves.not.toThrow();
    });

    it('retorna null para chave inexistente', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.validateKey('ak_ghost')).resolves.toBeNull();
    });

    it('retorna null para chave expirada', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        ...baseKey,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.validateKey('ak_expired')).resolves.toBeNull();
      expect(mockPrisma.apiKey.update).not.toHaveBeenCalled();
    });
  });
});
