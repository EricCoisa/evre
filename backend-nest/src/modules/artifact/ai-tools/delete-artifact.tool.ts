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
import { DeleteArtifactUseCase } from '../use-cases/delete-artifact.use-case';

const DeleteArtifactSchema = z.object({ id: z.string().uuid() }).strict();
type DeleteArtifactInput = z.infer<typeof DeleteArtifactSchema>;

@AiToolDef()
@Injectable()
export class DeleteArtifactTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'delete_artifact',
    description:
      'Exclui um artefato permanentemente, removendo também o(s) arquivo(s) do storage. Irreversível — use archive_artifact quando a exclusão não precisar ser definitiva.',
    inputSchema: DeleteArtifactSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ARTIFACT_WRITE,
    invalidates: [InvalidationTags.ARTIFACT],
  };

  constructor(private readonly deleteArtifact: DeleteArtifactUseCase) {}

  execute(input: DeleteArtifactInput, ctx: AiToolContext) {
    return this.deleteArtifact.execute(input.id, toAuthenticatedUser(ctx));
  }
}
