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
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { RemoveProjectUseCase } from '../use-cases/remove.use-case';

const RemoveProjectSchema = z.object({ id: z.string().uuid() }).strict();
type RemoveProjectInput = z.infer<typeof RemoveProjectSchema>;

@AiToolDef()
@Injectable()
export class RemoveProjectTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_project',
    description: 'Arquiva um projeto pelo id (nada é apagado).',
    inputSchema: RemoveProjectSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly removeProject: RemoveProjectUseCase) {}

  execute(input: RemoveProjectInput, ctx: AiToolContext) {
    return this.removeProject.execute(input.id, toAuthenticatedUser(ctx));
  }
}
