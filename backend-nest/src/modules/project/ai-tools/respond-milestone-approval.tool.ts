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
import { RespondApprovalUseCase } from '../use-cases/respond-approval.use-case';

const RespondMilestoneApprovalSchema = z
  .object({
    projectId: z.string().uuid(),
    approvalId: z.string().uuid(),
    status: z.enum(['APPROVED', 'REJECTED']),
    responseNote: z.string().max(2000).optional(),
  })
  .strict();
type RespondMilestoneApprovalInput = z.infer<
  typeof RespondMilestoneApprovalSchema
>;

@AiToolDef()
@Injectable()
export class RespondMilestoneApprovalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'respond_milestone_approval',
    description:
      'Aprova ou rejeita uma solicitação de aprovação de milestone pendente.',
    inputSchema: RespondMilestoneApprovalSchema,
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly respondApproval: RespondApprovalUseCase) {}

  execute(input: RespondMilestoneApprovalInput, ctx: AiToolContext) {
    const { projectId, approvalId, ...dto } = input;
    return this.respondApproval.execute(
      projectId,
      approvalId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
