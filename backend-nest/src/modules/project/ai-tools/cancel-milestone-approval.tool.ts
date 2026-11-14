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
import { CancelApprovalUseCase } from '../use-cases/cancel-approval.use-case';

const CancelMilestoneApprovalSchema = z
  .object({ projectId: z.string().uuid(), approvalId: z.string().uuid() })
  .strict();
type CancelMilestoneApprovalInput = z.infer<
  typeof CancelMilestoneApprovalSchema
>;

@AiToolDef()
@Injectable()
export class CancelMilestoneApprovalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'cancel_milestone_approval',
    description: 'Cancela uma solicitação de aprovação de milestone pendente.',
    inputSchema: CancelMilestoneApprovalSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly cancelApproval: CancelApprovalUseCase) {}

  execute(input: CancelMilestoneApprovalInput, ctx: AiToolContext) {
    return this.cancelApproval.execute(
      input.projectId,
      input.approvalId,
      toAuthenticatedUser(ctx),
    );
  }
}
