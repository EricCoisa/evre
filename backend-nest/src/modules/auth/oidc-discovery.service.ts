import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { RedisService } from '../../common/infrastructure/redis/redis.service';

const CACHE_PREFIX = 'oidc:discovery:v2:';
const CACHE_TTL = 86400; // 24h — o documento do issuer praticamente não muda

export interface OidcEndpoints {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
}

interface DiscoveryDocument {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  jwks_uri?: string;
}

/** OpenID Connect Discovery: resolve os endpoints de um issuer. */
@Injectable()
export class OidcDiscoveryService {
  private readonly jwks = new Map<
    string,
    ReturnType<typeof createRemoteJWKSet>
  >();

  constructor(private readonly redis: RedisService) {}

  async discover(issuer: string): Promise<OidcEndpoints> {
    const normalized = issuer.replace(/\/$/, '');

    // Recusa issuer que não seja https.
    if (new URL(normalized).protocol !== 'https:') {
      throw new ServiceUnavailableException(
        `Issuer precisa usar https: ${normalized}`,
      );
    }

    const cacheKey = `${CACHE_PREFIX}${normalized}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as OidcEndpoints;
      } catch {
        // cache corrompido → busca de novo
      }
    }

    let document: DiscoveryDocument;
    try {
      const response = await axios.get<DiscoveryDocument>(
        `${normalized}/.well-known/openid-configuration`,
        { timeout: 5000 },
      );
      document = response.data;
    } catch {
      throw new ServiceUnavailableException(
        `OIDC discovery falhou para o issuer ${normalized}`,
      );
    }

    if (
      !document?.issuer ||
      document.issuer.replace(/\/$/, '') !== normalized ||
      !document.authorization_endpoint ||
      !document.token_endpoint ||
      !document.jwks_uri
    ) {
      throw new ServiceUnavailableException(
        `Documento OIDC inválido para o issuer ${normalized}`,
      );
    }
    const jwksUrl = new URL(document.jwks_uri);
    if (jwksUrl.protocol !== 'https:') {
      throw new ServiceUnavailableException(
        `Documento OIDC inválido para o issuer ${normalized}`,
      );
    }

    const endpoints: OidcEndpoints = {
      issuer: document.issuer,
      authorizationEndpoint: document.authorization_endpoint,
      tokenEndpoint: document.token_endpoint,
      jwksUri: document.jwks_uri,
    };
    await this.redis.set(cacheKey, JSON.stringify(endpoints), CACHE_TTL);
    return endpoints;
  }

  async verifyIdToken(
    issuer: string,
    idToken: string,
    audience: string,
  ): Promise<JWTPayload> {
    const endpoints = await this.discover(issuer);
    let keySet = this.jwks.get(endpoints.jwksUri);
    if (!keySet) {
      keySet = createRemoteJWKSet(new URL(endpoints.jwksUri));
      this.jwks.set(endpoints.jwksUri, keySet);
    }

    const { payload } = await jwtVerify(idToken, keySet, {
      issuer: endpoints.issuer,
      audience,
      clockTolerance: 5,
      algorithms: [
        'RS256',
        'RS384',
        'RS512',
        'PS256',
        'PS384',
        'PS512',
        'ES256',
        'ES384',
        'ES512',
      ],
    });
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
      (audiences.length > 1 && payload.azp !== audience) ||
      (payload.azp !== undefined && payload.azp !== audience)
    ) {
      throw new Error('OIDC authorized party does not match the client');
    }
    return payload;
  }
}
