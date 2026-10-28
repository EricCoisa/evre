import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { GenerateInviteUseCase } from '../use-cases/generate-invite.use-case';
import { GenerateInviteTokenSchema } from '../dto/generate-invite-token.dto';

type GenerateInviteInput = z.infer<typeof GenerateInviteTokenSchema>;

@AiToolDef()
@Injectable()
export class GenerateInviteTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'generate_invite',
    description:
      'Gera um convite por e-mail para um novo usuário entrar no sistema com um role específico. Use list_system_roles para obter o roleId.',
    inputSchema: GenerateInviteTokenSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.INVITES_WRITE,
    invalidates: [InvalidationTags.AUTH],
  };

  constructor(private readonly generateInvite: GenerateInviteUseCase) {}

  execute(input: GenerateInviteInput, ctx: AiToolContext) {
    return this.generateInvite.execute({
      email: input.email,
      roleId: input.roleId,
      createdById: ctx.userId,
    });
  }
}
