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
import { CancelInfoRequestUseCase } from '../use-cases/cancel-info-request.use-case';

const CancelInfoRequestSchema = z
  .object({ projectId: z.string().uuid(), requestId: z.string().uuid() })
  .strict();
type CancelInfoRequestInput = z.infer<typeof CancelInfoRequestSchema>;

@AiToolDef()
@Injectable()
export class CancelInfoRequestTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'cancel_info_request',
    description: 'Cancela um pedido de informação pendente feito ao cliente.',
    inputSchema: CancelInfoRequestSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(
    private readonly cancelInfoRequest: CancelInfoRequestUseCase,
  ) {}

  execute(input: CancelInfoRequestInput, ctx: AiToolContext) {
    return this.cancelInfoRequest.execute(
      input.projectId,
      input.requestId,
      toAuthenticatedUser(ctx),
    );
  }
}
