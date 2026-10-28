import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { appPublicUrl } from 'src/common/utils/app-public-url.util';
import { MCP_PUBLIC_PATH } from 'src/domain/mcp/mcp.const';
import { McpTokenService } from './mcp-token.service';

export interface McpRequest extends Request {
  user?: {
    id: string;
    email: string;
    roleId: string | null;
    roleName: string;
  };
  mcpScopes?: string[];
  mcpGrantId?: string;
  authType?: string;
}

/** Valida o Bearer token MCP e popula request.user com o usuário e os scopes aprovados. */
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(private readonly tokens: McpTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<McpRequest>();
    const res = context.switchToHttp().getResponse<{
      setHeader: (k: string, v: string) => void;
    }>();

    const metadataUrl = `${appPublicUrl(req)}/.well-known/oauth-protected-resource/${MCP_PUBLIC_PATH}`;
    const challenge = (description: string) => {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${metadataUrl}", error="invalid_token", error_description="${description}"`,
      );
      return new UnauthorizedException(description);
    };

    const header = req.headers.authorization;
    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw challenge('Missing bearer token');
    }

    const principal = await this.tokens.validateAccessToken(
      header.slice(7).trim(),
    );
    if (!principal) throw challenge('Invalid or expired token');

    req.user = principal.user;
    req.mcpScopes = principal.scopes;
    req.mcpGrantId = principal.grantId;
    req.authType = 'mcp';
    return true;
  }
}
