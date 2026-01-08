import { Controller, Body, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApprovalService } from './approval.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ApprovalDto } from './dto/approval.dto';
import { PostApi, GetApi } from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';

@ApiTags('approval')
@Controller('approval')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @PostApi({
    path: '',
    summary: 'Create a new approval',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Approval created successfully',
          schema: { dto: ApprovalDto },
        },
      ],
    },
    authenticated: true,
    status: 'CREATED',
  })
  async create(
    @Body() createApprovalDto: CreateApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApprovalDto> {
    return this.approvalService.create(createApprovalDto, user.id);
  }

  @GetApi({
    path: ':entityType/:entityId',
    summary: 'Get approvals by entity',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Approvals retrieved successfully',
          schema: { dto: ApprovalDto, isArray: true },
        },
      ],
    },
    authenticated: true,
  })
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<ApprovalDto[]> {
    return this.approvalService.findByEntity(entityType, entityId);
  }
}
