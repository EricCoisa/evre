import { Body, Controller, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { plainToInstance } from 'class-transformer';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectDto } from './dto/project.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { ReorderDto } from './dto/reorder.dto';
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
import { CreateCommentDto } from './dto/create-comment.dto';
import { RequestApprovalDto } from './dto/request-approval.dto';
import { RespondApprovalDto } from './dto/respond-approval.dto';
import { CreateInfoRequestDto } from './dto/create-info-request.dto';
import { AnswerInfoRequestDto } from './dto/answer-info-request.dto';
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
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import {
  type PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';

@ApiTags('project')
@Controller('project')
export class ProjectController {
  constructor(
    private readonly findAllProject: FindAllProjectUseCase,
    private readonly findOneProject: FindOneProjectUseCase,
    private readonly createProject: CreateProjectUseCase,
    private readonly updateProject: UpdateProjectUseCase,
    private readonly removeProject: RemoveProjectUseCase,
    private readonly getBoard: GetBoardUseCase,
    private readonly createMilestone: CreateMilestoneUseCase,
    private readonly updateMilestone: UpdateMilestoneUseCase,
    private readonly removeMilestone: RemoveMilestoneUseCase,
    private readonly reorderMilestones: ReorderMilestonesUseCase,
    private readonly createTask: CreateTaskUseCase,
    private readonly updateTask: UpdateTaskUseCase,
    private readonly removeTask: RemoveTaskUseCase,
    private readonly moveTask: MoveTaskUseCase,
    private readonly reorderTasks: ReorderTasksUseCase,
    private readonly createComment: CreateCommentUseCase,
    private readonly listComments: ListCommentsUseCase,
    private readonly deleteComment: DeleteCommentUseCase,
    private readonly requestApproval: RequestApprovalUseCase,
    private readonly respondApproval: RespondApprovalUseCase,
    private readonly listApprovals: ListApprovalsUseCase,
    private readonly createInfoReq: CreateInfoRequestUseCase,
    private readonly answerInfoReq: AnswerInfoRequestUseCase,
    private readonly listInfoReqs: ListInfoRequestsUseCase,
    private readonly getInfoReqValue: GetInfoRequestValueUseCase,
  ) {}

  // ─── Project CRUD ───────────────────────────────────────────

  @PostApi({
    summary: 'project.create.title',
    description: 'project.create.description',
    body: CreateProjectDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Project created',
          schema: { dto: ProjectDto },
        },
      ],
    },
  })
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createProject.execute(dto, user.id);
  }

  @GetApi({
    summary: 'project.list.title',
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Paginated response',
          schema: { dto: ProjectDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponse<ProjectDto> | ProjectDto[]> {
    const result = await this.findAllProject.execute(query, user);
    if (Array.isArray(result)) {
      return plainToInstance(ProjectDto, result);
    }
    return {
      data: plainToInstance(ProjectDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @GetApi({
    path: ':id',
    summary: 'project.find.title',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Project found',
          schema: { dto: ProjectDto },
        },
      ],
    },
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.findOneProject.execute(id, user);
  }

  @PatchApi({
    path: ':id',
    summary: 'project.update.title',
    body: UpdateProjectDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Project updated',
          schema: { dto: ProjectDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateProject.execute(id, dto, user);
  }

  @DeleteApi({
    path: ':id',
    summary: 'project.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Project archived',
          schema: { dto: ProjectDto },
        },
      ],
    },
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.removeProject.execute(id, user);
  }

  // ─── Board ──────────────────────────────────────────────────

  @GetApi({
    path: ':id/board',
    summary: 'project.board.title',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        { status: 'OK', description: 'Board with milestones and tasks' },
      ],
    },
  })
  async board(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.getBoard.execute(id, user);
  }

  // ─── Milestones ─────────────────────────────────────────────

  @PatchApi({
    path: ':id/milestones/reorder',
    summary: 'project.milestone.reorder.title',
    body: ReorderDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'OK', description: 'Milestones reordered' }],
    },
  })
  async reorderMilestonesEndpoint(
    @Param('id') id: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.reorderMilestones.execute(id, dto, user);
  }

  @PostApi({
    path: ':id/milestones',
    summary: 'project.milestone.create.title',
    body: CreateMilestoneDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'CREATED', description: 'Milestone created' }],
    },
  })
  async addMilestone(
    @Param('id') id: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createMilestone.execute(id, dto, user);
  }

  @PatchApi({
    path: ':id/milestones/:milestoneId',
    summary: 'project.milestone.update.title',
    body: UpdateMilestoneDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'OK', description: 'Milestone updated' }],
    },
  })
  async editMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateMilestone.execute(id, milestoneId, dto, user);
  }

  @DeleteApi({
    path: ':id/milestones/:milestoneId',
    summary: 'project.milestone.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'OK', description: 'Milestone deleted' }],
    },
  })
  async deleteMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.removeMilestone.execute(id, milestoneId, user);
  }

  // ─── Tasks ──────────────────────────────────────────────────

  @PostApi({
    path: ':id/milestones/:milestoneId/tasks',
    summary: 'project.task.create.title',
    body: CreateTaskDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'CREATED', description: 'Task created' }],
    },
  })
  async addTask(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createTask.execute(id, milestoneId, dto, user);
  }

  @PatchApi({
    path: ':id/tasks/:taskId',
    summary: 'project.task.update.title',
    body: UpdateTaskDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'OK', description: 'Task updated' }],
    },
  })
  async editTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateTask.execute(id, taskId, dto, user);
  }

  @DeleteApi({
    path: ':id/tasks/:taskId',
    summary: 'project.task.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'OK', description: 'Task deleted' }],
    },
  })
  async deleteTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.removeTask.execute(id, taskId, user);
  }

  @PatchApi({
    path: ':id/tasks/:taskId/move',
    summary: 'project.task.move.title',
    body: MoveTaskDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'OK', description: 'Task moved' }],
    },
  })
  async moveTaskEndpoint(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moveTask.execute(id, taskId, dto, user);
  }

  @PatchApi({
    path: ':id/milestones/:milestoneId/tasks/reorder',
    summary: 'project.task.reorder.title',
    body: ReorderDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'OK', description: 'Tasks reordered' }],
    },
  })
  async reorderTasksEndpoint(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.reorderTasks.execute(id, milestoneId, dto, user);
  }

  // ─── Comments ──────────────────────────────────────────────

  @PostApi({
    path: ':id/comments',
    summary: 'project.comment.create.title',
    body: CreateCommentDto,
    status: 'CREATED',
    authenticated: true,
    response: {
      success: [{ status: 'CREATED', description: 'Comment created' }],
    },
  })
  async addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createComment.execute(id, dto, user);
  }

  @GetApi({
    path: ':id/comments',
    summary: 'project.comment.list.title',
    status: 'OK',
    authenticated: true,
    queries: [
      {
        name: 'entityType',
        required: true,
        enum: ['PROJECT', 'MILESTONE', 'TASK'],
      },
      { name: 'entityId', required: true },
    ],
    response: {
      success: [{ status: 'OK', description: 'Comments list' }],
    },
  })
  async getComments(
    @Param('id') id: string,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listComments.execute(id, entityType, entityId, user);
  }

  @DeleteApi({
    path: ':id/comments/:commentId',
    summary: 'project.comment.delete.title',
    status: 'OK',
    authenticated: true,
    response: {
      success: [{ status: 'OK', description: 'Comment deleted' }],
    },
  })
  async removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.deleteComment.execute(id, commentId, user);
  }

  // ─── Milestone Approvals ───────────────────────────────────

  @PostApi({
    path: ':id/milestones/:milestoneId/approvals',
    summary: 'project.approval.request.title',
    body: RequestApprovalDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'CREATED', description: 'Approval requested' }],
    },
  })
  async requestMilestoneApproval(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: RequestApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requestApproval.execute(id, milestoneId, dto, user);
  }

  @PatchApi({
    path: ':id/approvals/:approvalId',
    summary: 'project.approval.respond.title',
    body: RespondApprovalDto,
    status: 'OK',
    authenticated: true,
    response: {
      success: [{ status: 'OK', description: 'Approval responded' }],
    },
  })
  async respondMilestoneApproval(
    @Param('id') id: string,
    @Param('approvalId') approvalId: string,
    @Body() dto: RespondApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.respondApproval.execute(id, approvalId, dto, user);
  }

  @GetApi({
    path: ':id/milestones/:milestoneId/approvals',
    summary: 'project.approval.list.title',
    status: 'OK',
    authenticated: true,
    response: {
      success: [{ status: 'OK', description: 'Approvals list' }],
    },
  })
  async getMilestoneApprovals(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listApprovals.execute(id, milestoneId, user);
  }

  // ─── Info Requests ─────────────────────────────────────────

  @PostApi({
    path: ':id/info-requests',
    summary: 'project.infoRequest.create.title',
    body: CreateInfoRequestDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [{ status: 'CREATED', description: 'Info request created' }],
    },
  })
  async addInfoRequest(
    @Param('id') id: string,
    @Body() dto: CreateInfoRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createInfoReq.execute(id, dto, user);
  }

  @PatchApi({
    path: ':id/info-requests/:requestId/answer',
    summary: 'project.infoRequest.answer.title',
    body: AnswerInfoRequestDto,
    status: 'OK',
    authenticated: true,
    response: {
      success: [{ status: 'OK', description: 'Info request answered' }],
    },
  })
  async answerInfoRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: AnswerInfoRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.answerInfoReq.execute(id, requestId, dto, user);
  }

  @GetApi({
    path: ':id/info-requests',
    summary: 'project.infoRequest.list.title',
    status: 'OK',
    authenticated: true,
    response: {
      success: [{ status: 'OK', description: 'Info requests list' }],
    },
  })
  async getInfoRequests(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listInfoReqs.execute(id, user);
  }

  @GetApi({
    path: ':id/info-requests/:requestId/value',
    summary: 'project.infoRequest.getValue.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [{ status: 'OK', description: 'Decrypted value' }],
    },
  })
  async getInfoRequestValue(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.getInfoReqValue.execute(id, requestId);
  }
}
