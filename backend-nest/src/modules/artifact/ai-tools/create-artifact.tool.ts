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
import { UploadArtifactUseCase } from '../use-cases/upload-artifact.use-case';

const TEXT_CONTENT_TYPES = new Set([
  'text/html',
  'text/css',
  'application/javascript',
  'text/javascript',
  'application/json',
  'image/svg+xml',
]);

const CreateArtifactSchema = z
  .object({
    name: z.string().min(1).max(255),
    fileName: z.string().min(1).max(255),
    content: z.string().min(1),
    contentType: z
      .string()
      .refine((v) => TEXT_CONTENT_TYPES.has(v), {
        message: `contentType deve ser um de: ${[...TEXT_CONTENT_TYPES].join(', ')}`,
      })
      .default('text/html'),
  })
  .strict();
type CreateArtifactInput = z.infer<typeof CreateArtifactSchema>;

@AiToolDef()
@Injectable()
export class CreateArtifactTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_artifact',
    description:
      'Cria um novo artefato a partir de conteúdo textual gerado pelo modelo (HTML, CSS, JS, JSON, SVG). ' +
      'Ideal para gerar páginas, relatórios e dashboards diretamente via MCP. ' +
      'Após criar, use publish_artifact para publicar e obter o link de acesso.',
    inputSchema: CreateArtifactSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.ARTIFACT_WRITE,
    invalidates: [InvalidationTags.ARTIFACT],
  };

  constructor(private readonly uploadArtifact: UploadArtifactUseCase) {}

  execute(input: CreateArtifactInput, ctx: AiToolContext) {
    return this.uploadArtifact.execute(
      {
        buffer: Buffer.from(input.content, 'utf-8'),
        originalname: input.fileName,
        mimetype: input.contentType,
        size: Buffer.byteLength(input.content, 'utf-8'),
      },
      { id: ctx.userId, email: '', roleId: null, roleName: ctx.roleName },
      input.name,
    );
  }
}
