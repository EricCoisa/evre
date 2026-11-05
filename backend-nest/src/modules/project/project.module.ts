import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { CryptoModule } from '../../common/infrastructure/crypto/crypto.module';
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
import { ListApprovalsUseCase } from './use-cases/list-approvals.use-case';
import { CreateInfoRequestUseCase } from './use-cases/create-info-request.use-case';
import { AnswerInfoRequestUseCase } from './use-cases/answer-info-request.use-case';
import { ListInfoRequestsUseCase } from './use-cases/list-info-requests.use-case';
import { GetInfoRequestValueUseCase } from './use-cases/get-info-request-value.use-case';
import { ProjectRouteCeiling } from './project.route-ceiling';

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
  ListApprovalsUseCase,
  CreateInfoRequestUseCase,
  AnswerInfoRequestUseCase,
  ListInfoRequestsUseCase,
  GetInfoRequestValueUseCase,
];

@Module({
  imports: [PrismaModule, LoggingModule, CryptoModule],
  controllers: [ProjectController],
  providers: [...USE_CASES, ProjectRouteCeiling],
  exports: [FindOneProjectUseCase],
})
export class ProjectModule {}
