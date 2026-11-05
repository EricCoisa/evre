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
import { ArchiveArtifactUseCase } from '../use-cases/archive-artifact.use-case';

const ArchiveArtifactSchema = z.object({ id: z.string().uuid() }).strict();
type ArchiveArtifactInput = z.infer<typeof ArchiveArtifactSchema>;

@AiToolDef()
@Injectable()
export class ArchiveArtifactTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'archive_artifact',
    description:
      'Arquiva um artefato pelo id. Não apaga a linha nem o arquivo no storage — consumidores que já publicaram essa referência continuam funcionando.',
    inputSchema: ArchiveArtifactSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.ARTIFACT_WRITE,
    invalidates: [InvalidationTags.ARTIFACT],
  };

  constructor(private readonly archiveArtifact: ArchiveArtifactUseCase) {}

  execute(input: ArchiveArtifactInput, ctx: AiToolContext) {
    return this.archiveArtifact.execute(input.id, toAuthenticatedUser(ctx));
  }
}
