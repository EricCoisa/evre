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
import { RequestApprovalUseCase } from '../use-cases/request-approval.use-case';

const RequestMilestoneApprovalSchema = z
  .object({
    projectId: z.string().uuid(),
    milestoneId: z.string().uuid(),
    requestNote: z.string().max(2000).optional(),
  })
  .strict();
type RequestMilestoneApprovalInput = z.infer<
  typeof RequestMilestoneApprovalSchema
>;

@AiToolDef()
@Injectable()
export class RequestMilestoneApprovalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'request_milestone_approval',
    description:
      'Solicita aprovação de uma milestone. Se já houver uma solicitação pendente, atualiza a nota em vez de criar outra.',
    inputSchema: RequestMilestoneApprovalSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly requestApproval: RequestApprovalUseCase) {}

  execute(input: RequestMilestoneApprovalInput, ctx: AiToolContext) {
    const { projectId, milestoneId, ...dto } = input;
    return this.requestApproval.execute(
      projectId,
      milestoneId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
