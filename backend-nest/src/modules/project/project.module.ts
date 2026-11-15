import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { CryptoModule } from '../../common/infrastructure/crypto/crypto.module';
import { NotificationModule } from '../notification/notification.module';
import { FindAllProjectUseCase } from './use-cases/find-all.use-case';
import { FindOneProjectUseCase } from './use-cases/find-one.use-case';
import { CreateProjectUseCase } from './use-cases/create.use-case';
import { UpdateProjectUseCase } from './use-cases/update.use-case';
import { RemoveProjectUseCase } from './use-cases/remove.use-case';
import { GetBoardUseCase } from './use-cases/get-board.use-case';
import { CreateMilestoneUseCase } from './use-cases/create-milestone.use-case';
import { UpdateMilestoneUseCase } from './use-cases/update-milestone.use-case';
import { RemoveMilestoneUseCase } from './use-cases/remove-milestone.use-case';
import { ReorderMilestonesUseCase } from './use-cases/reorder-milestones.use-case';
import { CreateTaskUseCase } from './use-cases/create-task.use-case';
import { UpdateTaskUseCase } from './use-cases/update-task.use-case';
import { RemoveTaskUseCase } from './use-cases/remove-task.use-case';
import { MoveTaskUseCase } from './use-cases/move-task.use-case';
import { ReorderTasksUseCase } from './use-cases/reorder-tasks.use-case';
import { CreateCommentUseCase } from './use-cases/create-comment.use-case';
import { ListCommentsUseCase } from './use-cases/list-comments.use-case';
import { DeleteCommentUseCase } from './use-cases/delete-comment.use-case';
import { RequestApprovalUseCase } from './use-cases/request-approval.use-case';
import { RespondApprovalUseCase } from './use-cases/respond-approval.use-case';
import { CancelApprovalUseCase } from './use-cases/cancel-approval.use-case';
import { ListApprovalsUseCase } from './use-cases/list-approvals.use-case';
import { CreateInfoRequestUseCase } from './use-cases/create-info-request.use-case';
import { AnswerInfoRequestUseCase } from './use-cases/answer-info-request.use-case';
import { CancelInfoRequestUseCase } from './use-cases/cancel-info-request.use-case';
import { ListInfoRequestsUseCase } from './use-cases/list-info-requests.use-case';
import { GetInfoRequestValueUseCase } from './use-cases/get-info-request-value.use-case';
import { GetProjectMembersUseCase } from './use-cases/get-members.use-case';
import { ProjectRouteCeiling } from './project.route-ceiling';
import { CreateProjectTool } from './ai-tools/create-project.tool';
import { ListProjectsTool } from './ai-tools/list-projects.tool';
import { GetProjectTool } from './ai-tools/get-project.tool';
import { UpdateProjectTool } from './ai-tools/update-project.tool';
import { RemoveProjectTool } from './ai-tools/remove-project.tool';
import { GetProjectBoardTool } from './ai-tools/get-project-board.tool';
import { CreateMilestoneTool } from './ai-tools/create-milestone.tool';
import { UpdateMilestoneTool } from './ai-tools/update-milestone.tool';
import { RemoveMilestoneTool } from './ai-tools/remove-milestone.tool';
import { ReorderMilestonesTool } from './ai-tools/reorder-milestones.tool';
import { CreateTaskTool } from './ai-tools/create-task.tool';
import { UpdateTaskTool } from './ai-tools/update-task.tool';
import { RemoveTaskTool } from './ai-tools/remove-task.tool';
import { MoveTaskTool } from './ai-tools/move-task.tool';
import { ReorderTasksTool } from './ai-tools/reorder-tasks.tool';
import { CreateProjectCommentTool } from './ai-tools/create-project-comment.tool';
import { ListProjectCommentsTool } from './ai-tools/list-project-comments.tool';
import { RemoveProjectCommentTool } from './ai-tools/remove-project-comment.tool';
import { RequestMilestoneApprovalTool } from './ai-tools/request-milestone-approval.tool';
import { RespondMilestoneApprovalTool } from './ai-tools/respond-milestone-approval.tool';
import { CancelMilestoneApprovalTool } from './ai-tools/cancel-milestone-approval.tool';
import { ListMilestoneApprovalsTool } from './ai-tools/list-milestone-approvals.tool';
import { CreateInfoRequestTool } from './ai-tools/create-info-request.tool';
import { CancelInfoRequestTool } from './ai-tools/cancel-info-request.tool';
import { ListInfoRequestsTool } from './ai-tools/list-info-requests.tool';

const USE_CASES = [
  FindAllProjectUseCase,
  FindOneProjectUseCase,
  CreateProjectUseCase,
  UpdateProjectUseCase,
  RemoveProjectUseCase,
  GetBoardUseCase,
  CreateMilestoneUseCase,
  UpdateMilestoneUseCase,
  RemoveMilestoneUseCase,
  ReorderMilestonesUseCase,
  CreateTaskUseCase,
  UpdateTaskUseCase,
  RemoveTaskUseCase,
  MoveTaskUseCase,
  ReorderTasksUseCase,
  CreateCommentUseCase,
  ListCommentsUseCase,
  DeleteCommentUseCase,
  RequestApprovalUseCase,
  RespondApprovalUseCase,
  CancelApprovalUseCase,
  ListApprovalsUseCase,
  CreateInfoRequestUseCase,
  AnswerInfoRequestUseCase,
  CancelInfoRequestUseCase,
  ListInfoRequestsUseCase,
  GetInfoRequestValueUseCase,
  GetProjectMembersUseCase,
];

const AI_TOOLS = [
  CreateProjectTool,
  ListProjectsTool,
  GetProjectTool,
  UpdateProjectTool,
  RemoveProjectTool,
  GetProjectBoardTool,
  CreateMilestoneTool,
  UpdateMilestoneTool,
  RemoveMilestoneTool,
  ReorderMilestonesTool,
  CreateTaskTool,
  UpdateTaskTool,
  RemoveTaskTool,
  MoveTaskTool,
  ReorderTasksTool,
  CreateProjectCommentTool,
  ListProjectCommentsTool,
  RemoveProjectCommentTool,
  RequestMilestoneApprovalTool,
  RespondMilestoneApprovalTool,
  CancelMilestoneApprovalTool,
  ListMilestoneApprovalsTool,
  CreateInfoRequestTool,
  CancelInfoRequestTool,
  ListInfoRequestsTool,
];

@Module({
  imports: [PrismaModule, LoggingModule, CryptoModule, NotificationModule],
  controllers: [ProjectController],
  providers: [...USE_CASES, ...AI_TOOLS, ProjectRouteCeiling],
  exports: [FindOneProjectUseCase],
})
export class ProjectModule {}
