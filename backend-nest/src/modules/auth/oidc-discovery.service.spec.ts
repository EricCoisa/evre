import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import axios from 'axios';
import { RedisService } from '../../common/infrastructure/redis/redis.service';
import { OidcDiscoveryService } from './oidc-discovery.service';

vi.mock('axios');

const ISSUER = 'https://issuer.example.com';
const AUDIENCE = 'client-id';
const JWKS_URI = `${ISSUER}/jwks`;

describe('OidcDiscoveryService.verifyIdToken', () => {
  let service: OidcDiscoveryService;
  let privateKey: CryptoKey;
  let publicJwk: Awaited<ReturnType<typeof exportJWK>>;

  beforeAll(async () => {
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    publicJwk = {
      ...(await exportJWK(keys.publicKey)),
      kid: 'key-1',
      alg: 'RS256',
      use: 'sig',
    };
  });

  beforeEach(async () => {
    const redis = {
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          issuer: ISSUER,
          authorizationEndpoint: `${ISSUER}/authorize`,
          tokenEndpoint: `${ISSUER}/token`,
          jwksUri: JWKS_URI,
        }),
      ),
      set: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        OidcDiscoveryService,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(OidcDiscoveryService);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function signToken(
    input: {
      issuer?: string;
      audience?: string | string[];
      expiration?: string;
      key?: CryptoKey;
      azp?: string;
    } = {},
  ) {
    const builder = new SignJWT({
      ...(input.azp ? { azp: input.azp } : {}),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setIssuer(input.issuer ?? ISSUER)
      .setAudience(input.audience ?? AUDIENCE)
      .setIssuedAt();
    if (input.expiration) builder.setExpirationTime(input.expiration);
    else builder.setExpirationTime('5m');
    return builder.sign(input.key ?? privateKey);
  }

  it('accepts a signed token only for its trusted issuer and client audience', async () => {
    const token = await signToken();
    await expect(
      service.verifyIdToken(ISSUER, token, AUDIENCE),
    ).resolves.toMatchObject({ iss: ISSUER, aud: AUDIENCE });
  });

  it('rejects an invalid signature', async () => {
    const wrongKey = await generateKeyPair('RS256');
    const token = await signToken({ key: wrongKey.privateKey });
    await expect(
      service.verifyIdToken(ISSUER, token, AUDIENCE),
    ).rejects.toThrow();
  });

  it('rejects wrong issuer, audience, and expired tokens', async () => {
    await expect(
      service.verifyIdToken(
        ISSUER,
        await signToken({ issuer: 'https://other.example.com' }),
        AUDIENCE,
      ),
    ).rejects.toThrow();
    await expect(
      service.verifyIdToken(
        ISSUER,
        await signToken({ audience: 'other-client' }),
        AUDIENCE,
      ),
    ).rejects.toThrow();
    await expect(
      service.verifyIdToken(
        ISSUER,
        await signToken({ expiration: '1h ago' }),
        AUDIENCE,
      ),
    ).rejects.toThrow();
  });

  it('rejects a mismatched authorized party when the token has multiple audiences', async () => {
    const token = await signToken({
      audience: [AUDIENCE, 'another-client'],
      azp: 'another-client',
    });
    await expect(
      service.verifyIdToken(ISSUER, token, AUDIENCE),
    ).rejects.toThrow('authorized party');
  });
});

describe('OidcDiscoveryService.discover', () => {
  const document = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    jwks_uri: JWKS_URI,
  };

  async function buildService(redisGet: unknown) {
    const redis = { get: vi.fn().mockResolvedValue(redisGet), set: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [OidcDiscoveryService, { provide: RedisService, useValue: redis }],
    }).compile();
    return { service: module.get(OidcDiscoveryService) as OidcDiscoveryService, redis };
  }

  beforeEach(() => vi.clearAllMocks());

  it('rejects an issuer that is not https', async () => {
    const { service } = await buildService(null);
    await expect(service.discover('http://issuer.example.com')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('returns the cached endpoints without hitting the network', async () => {
    const { service, redis } = await buildService(
      JSON.stringify({
        issuer: ISSUER,
        authorizationEndpoint: `${ISSUER}/authorize`,
        tokenEndpoint: `${ISSUER}/token`,
        jwksUri: JWKS_URI,
      }),
    );

    const endpoints = await service.discover(ISSUER);

    expect(endpoints.jwksUri).toBe(JWKS_URI);
    expect(redis.get).toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('fetches the discovery document when the cache is corrupted', async () => {
    const { service, redis } = await buildService('{not json');
    vi.mocked(axios.get).mockResolvedValue({ data: document });

    const endpoints = await service.discover(ISSUER);

    expect(endpoints.jwksUri).toBe(JWKS_URI);
    expect(redis.set).toHaveBeenCalled();
  });

  it('throws when the discovery endpoint is unreachable', async () => {
    const { service } = await buildService(null);
    vi.mocked(axios.get).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.discover(ISSUER)).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when the document is missing required fields', async () => {
    const { service } = await buildService(null);
    vi.mocked(axios.get).mockResolvedValue({ data: { issuer: ISSUER } });

    await expect(service.discover(ISSUER)).rejects.toThrow(
      'Documento OIDC inválido',
    );
  });

  it('throws when the document issuer does not match the requested one', async () => {
    const { service } = await buildService(null);
    vi.mocked(axios.get).mockResolvedValue({
      data: { ...document, issuer: 'https://outro.example.com' },
    });

    await expect(service.discover(ISSUER)).rejects.toThrow(
      'Documento OIDC inválido',
    );
  });

  it('throws when jwks_uri is not https', async () => {
    const { service } = await buildService(null);
    vi.mocked(axios.get).mockResolvedValue({
      data: { ...document, jwks_uri: 'http://issuer.example.com/jwks' },
    });

    await expect(service.discover(ISSUER)).rejects.toThrow(
      'Documento OIDC inválido',
    );
  });

  it('caches and returns the endpoints on a fresh successful lookup', async () => {
    const { service, redis } = await buildService(null);
    vi.mocked(axios.get).mockResolvedValue({ data: document });

    const endpoints = await service.discover(ISSUER);

    expect(endpoints).toEqual({
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}/authorize`,
      tokenEndpoint: `${ISSUER}/token`,
      jwksUri: JWKS_URI,
    });
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining(ISSUER),
      JSON.stringify(endpoints),
      86400,
    );
  });
});
