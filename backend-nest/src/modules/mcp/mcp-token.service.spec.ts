import { McpTokenService } from './mcp-token.service';

const mockPrisma = {
  oAuthGrant: { findUnique: vi.fn(), update: vi.fn() },
};

const ACTIVE_USER = {
  id: 'u1',
  email: 'a@b.com',
  status: 'ACTIVE',
  deletedAt: null,
  roleId: 'r1',
  roleRecord: { name: 'ADMIN' },
};

describe('McpTokenService', () => {
  let service: McpTokenService;

  const grant = (over: Record<string, unknown> = {}) => ({
    id: 'g1',
    scopes: ['users:read'],
    accessExpiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user: ACTIVE_USER,
    ...over,
  });

  beforeEach(() => {
    service = new McpTokenService(mockPrisma as never);
    vi.clearAllMocks();
    mockPrisma.oAuthGrant.update.mockResolvedValue({});
  });

  it('gera token com prefixo e nunca repete', () => {
    const a = service.generate('mcpat_');
    expect(a).toMatch(/^mcpat_[A-Za-z0-9_-]+$/);
    expect(service.generate('mcpat_')).not.toBe(a);
  });

  it('s256 casa com o code_challenge do RFC 7636 §4.2 (vetor do próprio RFC)', () => {
    expect(service.s256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('safeEqual não confunde tamanhos diferentes', () => {
    expect(service.safeEqual('abc', 'abc')).toBe(true);
    expect(service.safeEqual('abc', 'abcd')).toBe(false);
    expect(service.safeEqual('abc', 'abd')).toBe(false);
  });

  it('resolve token válido em usuário + scopes', async () => {
    mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant());

    const principal = await service.validateAccessToken('mcpat_x');

    expect(mockPrisma.oAuthGrant.findUnique.mock.calls[0][0].where).toEqual({
      accessHash: service.hash('mcpat_x'),
    });
    expect(principal).toEqual({
      user: { id: 'u1', email: 'a@b.com', roleId: 'r1', roleName: 'ADMIN' },
      scopes: ['users:read'],
      grantId: 'g1',
    });
  });

  it('recusa token inexistente, revogado ou expirado', async () => {
    mockPrisma.oAuthGrant.findUnique.mockResolvedValue(null);
    expect(await service.validateAccessToken('x')).toBeNull();

    mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant({ revokedAt: new Date() }));
    expect(await service.validateAccessToken('x')).toBeNull();

    mockPrisma.oAuthGrant.findUnique.mockResolvedValue(
      grant({ accessExpiresAt: new Date(Date.now() - 1000) }),
    );
    expect(await service.validateAccessToken('x')).toBeNull();

    mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant({ accessExpiresAt: null }));
    expect(await service.validateAccessToken('x')).toBeNull();
  });

  it('dono inativo ou excluído invalida o token — mesma regra da sessão', async () => {
    mockPrisma.oAuthGrant.findUnique.mockResolvedValue(
      grant({ user: { ...ACTIVE_USER, status: 'SUSPENDED' } }),
    );
    expect(await service.validateAccessToken('x')).toBeNull();

    mockPrisma.oAuthGrant.findUnique.mockResolvedValue(
      grant({ user: { ...ACTIVE_USER, deletedAt: new Date() } }),
    );
    expect(await service.validateAccessToken('x')).toBeNull();
  });

  it('usuário sem role cai em USER', async () => {
    mockPrisma.oAuthGrant.findUnique.mockResolvedValue(
      grant({ user: { ...ACTIVE_USER, roleId: null, roleRecord: null } }),
    );
    const principal = await service.validateAccessToken('x');
    expect(principal?.user).toMatchObject({ roleId: null, roleName: 'USER' });
  });

  it('issueTokens devolve expires_in coerente com o accessExpiresAt gravado', async () => {
    const res = await service.issueTokens('g1', ['users:read']);
    const { accessExpiresAt } = mockPrisma.oAuthGrant.update.mock.calls[0][0].data;
    const delta = (accessExpiresAt.getTime() - Date.now()) / 1000;
    expect(Math.abs(delta - res.expires_in)).toBeLessThan(5);
  });
});
