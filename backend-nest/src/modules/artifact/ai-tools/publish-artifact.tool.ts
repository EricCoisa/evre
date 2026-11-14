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
import { PublishArtifactUseCase } from '../use-cases/publish-artifact.use-case';

const PublishArtifactSchema = z
  .object({
    id: z.string().uuid(),
    published: z.boolean().default(true),
    public: z.boolean().default(false),
  })
  .strict();
type PublishArtifactInput = z.infer<typeof PublishArtifactSchema>;

@AiToolDef()
@Injectable()
export class PublishArtifactTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'publish_artifact',
    description:
      'Publica ou despublica um artefato, e define se o link público (sem autenticação) fica habilitado.',
    inputSchema: PublishArtifactSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.ARTIFACT_WRITE,
    invalidates: [InvalidationTags.ARTIFACT],
  };

  constructor(private readonly publishArtifact: PublishArtifactUseCase) {}

  execute(input: PublishArtifactInput, _ctx: AiToolContext) {
    return this.publishArtifact.execute(input.id, {
      published: input.published,
      public: input.public,
    });
  }
}
