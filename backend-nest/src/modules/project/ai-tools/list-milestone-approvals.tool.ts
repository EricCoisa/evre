import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { ListApprovalsUseCase } from '../use-cases/list-approvals.use-case';

const ListMilestoneApprovalsSchema = z
  .object({ projectId: z.string().uuid(), milestoneId: z.string().uuid() })
  .strict();
type ListMilestoneApprovalsInput = z.infer<typeof ListMilestoneApprovalsSchema>;

@AiToolDef()
@Injectable()
export class ListMilestoneApprovalsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_milestone_approvals',
    description:
      'Lista o histórico de solicitações de aprovação de uma milestone.',
    inputSchema: ListMilestoneApprovalsSchema,
    invalidates: [],
  };

  constructor(private readonly listApprovals: ListApprovalsUseCase) {}

  execute(input: ListMilestoneApprovalsInput, ctx: AiToolContext) {
    return this.listApprovals.execute(
      input.projectId,
      input.milestoneId,
      toAuthenticatedUser(ctx),
    );
  }
}
