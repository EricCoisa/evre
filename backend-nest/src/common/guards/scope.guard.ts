import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const API_SCOPE_KEY = 'api_scope';

interface RequestWithApiKeyScope extends Request {
  authType?: string;
  apiKeyScopes?: string[];
}

/** Default-deny de scope para API key; requisição JWT passa direto. */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithApiKeyScope>();

    // Só API keys passam pelo controle de scope; JWT ignora.
    if (request.authType !== 'api-key') {
      return true;
    }

    const required = this.reflector.get<string>(
      API_SCOPE_KEY,
      context.getHandler(),
    );

    if (!required) {
      throw new ForbiddenException('Endpoint not available for API keys');
    }

    if (!request.apiKeyScopes?.includes(required)) {
      throw new ForbiddenException(`Missing scope: ${required}`);
    }

    return true;
  }
}
