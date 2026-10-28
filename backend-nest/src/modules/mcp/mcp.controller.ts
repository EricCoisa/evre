import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { MCP_CONNECTORS_FLAG } from 'src/domain/mcp/mcp.const';
import {
  FeatureFlagGuard,
  RequireFeature,
} from '../feature-flag/feature-flag.guard';
import { McpAuthGuard, type McpRequest } from './mcp-auth.guard';
import { McpService } from './mcp.service';

/** Endpoint MCP remoto (JSON-RPC 2.0) usado por Claude Desktop e ChatGPT como conector. */
@ApiExcludeController()
@Controller('mcp')
@UseGuards(McpAuthGuard, FeatureFlagGuard)
@RequireFeature(MCP_CONNECTORS_FLAG)
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  async rpc(
    @Body() body: unknown,
    @Req() req: McpRequest,
    @Res() res: Response,
  ) {
    const result = await this.mcp.handle(body, {
      userId: req.user!.id,
      roleName: req.user!.roleName,
      approvedScopes: req.mcpScopes ?? [],
    });

    // Só notificações: nada a responder (Streamable HTTP manda 202 nesse caso).
    if (result === null) {
      res.status(202).end();
      return;
    }

    res.status(200).json(result);
  }

  /** Recusa o stream SSE server→client com 405; o cliente opera só com POST. */
  @Get()
  @HttpCode(405)
  noStream() {
    return { error: 'SSE stream not supported; use POST' };
  }

  /** Sessão explícita não existe (modo stateless), então não há o que encerrar. */
  @Delete()
  @HttpCode(204)
  noSession() {}
}
