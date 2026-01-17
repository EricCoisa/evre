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
import { ApprovalRequestService } from './approval-request.service';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { UpdateApprovalRequestDto } from './dto/update-approval-request.dto';
import { ApprovalRequestDto } from './dto/approval-request.dto';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import {
  type PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';

@ApiTags('approval-request')
@Controller('approval-request')
export class ApprovalRequestController {
  constructor(
    private readonly approvalRequestService: ApprovalRequestService,
  ) {}

  @PostApi({
    summary: 'approval_request.create.title',
    description: 'approval_request.create.description',
    body: CreateApprovalRequestDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async create(
    @Body() dto: CreateApprovalRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.approvalRequestService.create(dto, currentUser.id);
  }

  @GetApi({
    summary: 'approval_request.list.title',
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Paginated response',
          schema: {
            dto: ApprovalRequestDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<ApprovalRequestDto> | ApprovalRequestDto[]> {
    const result = await this.approvalRequestService.findAll(query);

    if (Array.isArray(result)) {
      return plainToInstance(ApprovalRequestDto, result);
    }

    return {
      data: plainToInstance(ApprovalRequestDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @GetApi({
    path: 'stage/:stageId',
    summary: 'approval_request.find_by_stage.title',
    status: 'OK',
    authenticated: true,
  })
  async findByStage(@Param('stageId') stageId: string) {
    return this.approvalRequestService.findByStage(stageId);
  }

  @GetApi({
    path: ':id',
    summary: 'approval_request.find.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async findOne(@Param('id') id: string) {
    return this.approvalRequestService.findOne(id);
  }

  @PatchApi({
    path: ':id',
    summary: 'approval_request.update.title',
    body: UpdateApprovalRequestDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApprovalRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.approvalRequestService.update(id, dto, currentUser.id);
  }

  @DeleteApi({
    path: ':id',
    summary: 'approval_request.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.approvalRequestService.remove(currentUser.id, id);
  }
}
