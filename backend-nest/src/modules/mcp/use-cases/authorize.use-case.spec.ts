import { JwtService } from '@nestjs/jwt';

import { AuthorizeUseCase } from './authorize.use-case';
import { McpTokenService } from '../mcp-token.service';
import { OAuthError } from '../oauth-error';

const CLIENT = {
  id: 'c1',
  name: 'Claude Desktop',
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
};

const mockPrisma = {
  oAuthClient: { findUnique: vi.fn() },
  oAuthGrant: { create: vi.fn() },
};
const mockConfig = {
  get: vi.fn((k: string) =>
    k === 'JWT_SECRET' ? 'test-secret' : 'https://front.example.com/',
  ),
};
const mockLogging = { create: vi.fn() };

/** Origem pública do fluxo — o proxy do front a informa por request. */
const ORIGIN = 'https://tunnel.example.com';

const validQuery = {
  response_type: 'code',
  client_id: 'c1',
  redirect_uri: CLIENT.redirectUris[0],
  code_challenge: 'Q0hBTExFTkdF',
  code_challenge_method: 'S256',
  state: 'st-123',
  scope: 'users:read feature-flags:write bogus:scope',
};

describe('AuthorizeUseCase', () => {
  let useCase: AuthorizeUseCase;
  // Serviço real: hash/generate são puros e o que interessa testar é o efeito deles.
  const tokens = new McpTokenService(mockPrisma as never);

  beforeEach(() => {
    useCase = new AuthorizeUseCase(
      mockPrisma as never,
      new JwtService({}),
      mockConfig as never,
      tokens,
      mockLogging as never,
    );
    vi.clearAllMocks();
    mockConfig.get.mockImplementation((k: string) =>
      k === 'JWT_SECRET' ? 'test-secret' : 'https://front.example.com/',
    );
    mockLogging.create.mockResolvedValue(undefined);
    mockPrisma.oAuthClient.findUnique.mockResolvedValue(CLIENT);
    mockPrisma.oAuthGrant.create.mockImplementation(({ data }: never) => ({
      id: 'g1',
      ...(data as object),
      client: { name: CLIENT.name },
    }));
  });

  describe('start', () => {
    it('manda o browser para a tela de consentimento na origem do FLUXO', async () => {
      const url = await useCase.start(validQuery, ORIGIN);
      expect(url).toMatch(/^https:\/\/tunnel\.example\.com\/profile\/connect\?req=/);
    });

    it('ignora NEXTAUTH_URL: o consentimento tem de ficar no domínio que o cliente acessou', async () => {
      // Se caísse no NEXTAUTH_URL (https://front.example.com), quem entrou por um
      // tunnel voltaria para outro domínio — e sem sessão.
      const url = await useCase.start(validQuery, 'https://outro.example.com');
      expect(url).toContain('https://outro.example.com/profile/connect');
      expect(url).not.toContain('front.example.com');
    });

    it('recusa response_type diferente de code', async () => {
      await expect(
        useCase.start({ ...validQuery, response_type: 'token' }, ORIGIN),
      ).rejects.toThrow(OAuthError);
    });

    it('recusa client_id ausente ou desconhecido', async () => {
      await expect(
        useCase.start({ ...validQuery, client_id: undefined }, ORIGIN),
      ).rejects.toThrow(OAuthError);

      mockPrisma.oAuthClient.findUnique.mockResolvedValue(null);
      await expect(useCase.start(validQuery, ORIGIN)).rejects.toThrow(OAuthError);
    });

    it('recusa redirect_uri que não bate EXATAMENTE com uma registrada', async () => {
      await expect(
        useCase.start({ ...validQuery, redirect_uri: 'https://claude.ai/api/mcp/auth_callback/x' }, ORIGIN),
      ).rejects.toThrow(OAuthError);
      await expect(
        useCase.start({ ...validQuery, redirect_uri: undefined }, ORIGIN),
      ).rejects.toThrow(OAuthError);
    });

    it('exige PKCE S256 — sem challenge, ou com plain, recusa', async () => {
      await expect(
        useCase.start({ ...validQuery, code_challenge: undefined }, ORIGIN),
      ).rejects.toThrow(OAuthError);
      await expect(
        useCase.start({ ...validQuery, code_challenge_method: 'plain' }, ORIGIN),
      ).rejects.toThrow(OAuthError);
    });
  });

  describe('describe', () => {
    it('devolve o cliente pedindo acesso e descarta scope desconhecido', async () => {
      const req = new URL(await useCase.start(validQuery, ORIGIN)).searchParams.get('req')!;
      const info = await useCase.describe(req);

      expect(info.clientName).toBe('Claude Desktop');
      expect(info.requestedScopes).toEqual(['users:read', 'feature-flags:write']);
      expect(info.availableScopes).toContain('users:read');
    });

    it('scope ausente vira lista vazia (cliente deixa o usuário escolher)', async () => {
      const url = await useCase.start({ ...validQuery, scope: undefined }, ORIGIN);
      const info = await useCase.describe(new URL(url).searchParams.get('req')!);
      expect(info.requestedScopes).toEqual([]);
    });

    it('req forjado ou expirado é recusado', async () => {
      await expect(useCase.describe('not-a-jwt')).rejects.toThrow(OAuthError);
    });

    it('req assinado com outro segredo não passa — não é token de sessão', async () => {
      // Mesmo payload assinado com o JWT_SECRET cru (o da sessão) deve falhar:
      // o segredo do pedido pendente é derivado com sufixo próprio.
      const foreign = await new JwtService({}).signAsync(
        { cid: 'c1', uri: CLIENT.redirectUris[0], chal: 'x', scope: [] },
        { secret: 'test-secret' },
      );
      await expect(useCase.describe(foreign)).rejects.toThrow(OAuthError);
    });

    it('cliente apagado entre o authorize e o consentimento é recusado', async () => {
      const req = new URL(await useCase.start(validQuery, ORIGIN)).searchParams.get('req')!;
      mockPrisma.oAuthClient.findUnique.mockResolvedValue(null);
      await expect(useCase.describe(req)).rejects.toThrow(OAuthError);
    });
  });

  describe('approve', () => {
    const pendingReq = async () =>
      new URL(await useCase.start(validQuery, ORIGIN)).searchParams.get('req')!;

    it('cria a conexão com code hasheado e devolve code + state na redirect_uri', async () => {
      const result = await useCase.approve(await pendingReq(), ['users:read'], 'u1');

      const created = mockPrisma.oAuthGrant.create.mock.calls[0][0].data;
      expect(created).toMatchObject({
        clientId: 'c1',
        userId: 'u1',
        scopes: ['users:read'],
        codeChallenge: validQuery.code_challenge,
        redirectUri: validQuery.redirect_uri,
      });

      const redirect = new URL(result.redirectTo);
      expect(redirect.origin + redirect.pathname).toBe(validQuery.redirect_uri);
      expect(redirect.searchParams.get('state')).toBe('st-123');

      // O code cru vai só na URL; o banco guarda o hash.
      const code = redirect.searchParams.get('code')!;
      expect(code).toMatch(/^mcpac_/);
      expect(created.codeHash).toBe(tokens.hash(code));
      expect(JSON.stringify(created)).not.toContain(code);
    });

    it('sem state no pedido, a redirect volta sem state', async () => {
      const url = await useCase.start({ ...validQuery, state: undefined }, ORIGIN);
      const result = await useCase.approve(
        new URL(url).searchParams.get('req')!,
        [],
        'u1',
      );
      expect(new URL(result.redirectTo).searchParams.has('state')).toBe(false);
    });

    it('recusa scope que não existe no vocabulário em vez de ignorar calado', async () => {
      await expect(
        useCase.approve(await pendingReq(), ['users:read', 'root:everything'], 'u1'),
      ).rejects.toThrow(OAuthError);
      expect(mockPrisma.oAuthGrant.create).not.toHaveBeenCalled();
    });

    it('registra a autorização no log de auditoria do usuário', async () => {
      await useCase.approve(await pendingReq(), ['users:read'], 'u1');
      expect(mockLogging.create).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'MCP' }),
        'u1',
      );
    });
  });
});
