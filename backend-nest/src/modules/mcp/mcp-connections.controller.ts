import { Controller, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from 'src/common/types/auth.types';
import {
  DeleteApi,
  GetApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConnectionsUseCase } from './use-cases/connections.use-case';

/** Lado "aplicação" do MCP: o que a aba Conectores do perfil consome. */
@ApiTags('mcp')
@Controller('mcp-connections')
export class McpConnectionsController {
  constructor(private readonly connections: ConnectionsUseCase) {}

  @GetApi({
    path: '',
    summary: 'List connected MCP clients',
    authenticated: true,
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.connections.list(user.id);
  }

  @DeleteApi({
    path: ':id',
    status: 'NO_CONTENT',
    summary: 'Revoke a connected MCP client',
    authenticated: true,
  })
  revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.connections.revoke(id, user.id);
  }
}
