import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import type { Request } from 'express';

import { ApiKeyService } from './api-key.service';

interface ApiKeyRequest extends Request {
  apiKeyScopes?: string[];
  authType?: string;
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly apiKeyService: ApiKeyService) {
    super();
  }

  async validate(req: ApiKeyRequest) {
    const raw = req.headers['x-api-key'];

    // Falha RÁPIDA sem o header — sem isso o fallback jwt→api-key quebra.
    if (!raw || typeof raw !== 'string') {
      throw new UnauthorizedException();
    }

    const found = await this.apiKeyService.validateKey(raw);
    if (!found) throw new UnauthorizedException();

    // Dono inativo/suspenso/excluido invalida a chave - mesma regra da JwtStrategy.
    if (found.user.deletedAt !== null || found.user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    req.apiKeyScopes = found.scopes;
    req.authType = 'api-key';

    // ⚠️ MESMO shape da JwtStrategy — RolesGuard lê request.user.roleName.
    return {
      id: found.user.id,
      email: found.user.email,
      roleId: found.user.roleId ?? null,
      roleName: found.user.roleRecord?.name ?? 'USER',
    };
  }
}
