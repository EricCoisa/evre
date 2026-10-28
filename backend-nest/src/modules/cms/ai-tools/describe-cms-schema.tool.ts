import { Injectable, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { CheckAccessUseCase } from '../../user-route-access/use-cases/check-access.use-case';
import { CmsAgentBridgeService } from '../services/cms-agent-bridge.service';

@AiToolDef()
@Injectable()
export class DescribeCmsSchemaTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'describe_cms_schema',
    description:
      'Lista as collections do Payload CMS e seus campos atuais (nome, tipo, obrigatório). ' +
      'Sempre chame esta tool antes de ler ou editar conteúdo do CMS — o schema muda conforme ' +
      'páginas/campos são adicionados ou removidos no admin, então nunca assuma um shape fixo.',
    inputSchema: z.object({}),
    invalidates: [],
    roles: ['ADMIN', 'MODERATOR'],
  };

  constructor(
    private readonly checkAccess: CheckAccessUseCase,
    private readonly cmsBridge: CmsAgentBridgeService,
  ) {}

  async execute(_input: unknown, ctx: AiToolContext) {
    const hasAccess = await this.checkAccess.execute(ctx.userId, '/cms');
    if (!hasAccess) {
      throw new ForbiddenException('Usuário sem acesso ao CMS');
    }
    return this.cmsBridge.describeSchema();
  }
}
