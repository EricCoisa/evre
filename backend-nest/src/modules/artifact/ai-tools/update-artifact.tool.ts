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
import { UpdateArtifactUseCase } from '../use-cases/update-artifact.use-case';

const UpdateArtifactSchema = z
  .object({ id: z.string().uuid(), name: z.string().min(1).max(255) })
  .strict();
type UpdateArtifactInput = z.infer<typeof UpdateArtifactSchema>;

@AiToolDef()
@Injectable()
export class UpdateArtifactTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_artifact',
    description: 'Renomeia um artefato pelo id.',
    inputSchema: UpdateArtifactSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.ARTIFACT_WRITE,
    invalidates: [InvalidationTags.ARTIFACT],
  };

  constructor(private readonly updateArtifact: UpdateArtifactUseCase) {}

  execute(input: UpdateArtifactInput, _ctx: AiToolContext) {
    return this.updateArtifact.execute(input.id, { name: input.name });
  }
}
