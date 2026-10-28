import { Controller, Get, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { appPublicUrl } from 'src/common/utils/app-public-url.util';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import {
  MCP_PUBLIC_PATH,
  MCP_SERVER_NAME,
  OAUTH_PUBLIC_PATH,
} from 'src/domain/mcp/mcp.const';
import type { Request } from 'express';

const SCOPES = Object.values(McpScopes);

/** Expõe os metadados de descoberta OAuth do conector MCP fora do prefixo api/v1, apontando para o front. */
@ApiExcludeController()
@Controller()
export class McpDiscoveryController {
  /** RFC 9728: o caminho com sufixo é o do spec; o nu é o fallback que vários clientes tentam. */
  @Get([
    '.well-known/oauth-protected-resource',
    `.well-known/oauth-protected-resource/${MCP_PUBLIC_PATH}`,
  ])
  protectedResource(@Req() req: Request) {
    const base = appPublicUrl(req);
    return {
      resource: `${base}/${MCP_PUBLIC_PATH}`,
      authorization_servers: [base],
      scopes_supported: SCOPES,
      bearer_methods_supported: ['header'],
      resource_name: MCP_SERVER_NAME,
    };
  }

  /** RFC 8414. */
  @Get('.well-known/oauth-authorization-server')
  authorizationServer(@Req() req: Request) {
    const base = appPublicUrl(req);
    const oauth = `${base}/${OAUTH_PUBLIC_PATH}`;
    return {
      issuer: base,
      authorization_endpoint: `${oauth}/authorize`,
      token_endpoint: `${oauth}/token`,
      registration_endpoint: `${oauth}/register`,
      revocation_endpoint: `${oauth}/revoke`,
      scopes_supported: SCOPES,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      // RFC 8707: o cliente amarra o token ao recurso pedido. Aceitamos o
      // parâmetro para não quebrar clientes que o exigem.
      authorization_response_iss_parameter_supported: false,
    };
  }
}
