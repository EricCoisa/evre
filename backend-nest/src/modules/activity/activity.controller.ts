import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityDto } from './dto/activity.dto';
import { MoveActivityDto } from './dto/move-activity.dto';
import { ReorderActivitiesDto } from './dto/reorder-activities.dto';
import { StatusResponseDto } from '../../common/schemas/status-response.dto';
import {
  GetApi,
  PostApi,
  PatchApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import { PaginatedResponse } from '../../common/types/pagination.types';
import { plainToInstance } from 'class-transformer';

@ApiTags('activity')
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @GetApi({
    path: 'status',
    summary: 'Get list of activity statuses',
    description: 'Returns a list of all possible activity statuses',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Activity statuses retrieved successfully',
        },
      ],
    },
    authenticated: true,
  })
  getStatusList(): string[] {
    return this.activityService.getStatusList();
  }

  @PostApi({
    path: '',
    summary: 'Create a new activity',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Activity created successfully',
          schema: { dto: ActivityDto },
        },
      ],
    },
    authenticated: true,
    status: 'CREATED',
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async create(
    @Body() createActivityDto: CreateActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActivityDto> {
    return this.activityService.create(createActivityDto, user.id);
  }

  @GetApi({
    path: '',
    summary: 'List all activities',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Activities retrieved successfully',
          schema: { dto: ActivityDto, isArray: true, isPagination: true },
        },
      ],
    },
    authenticated: true,
    queries: commonPaginationQueries,
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<ActivityDto> | ActivityDto[]> {
    const result = await this.activityService.findAll(query);
    if (Array.isArray(result)) return plainToInstance(ActivityDto, result);
    return { ...result, data: plainToInstance(ActivityDto, result.data) };
  }

  @GetApi({
    path: ':id',
    summary: 'Get activity by ID',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Activity retrieved successfully',
          schema: { dto: ActivityDto },
        },
      ],
    },
    authenticated: true,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActivityDto> {
    return this.activityService.findOne(id, user);
  }

  @PatchApi({
    path: ':id',
    summary: 'Update an activity',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Activity updated successfully',
          schema: { dto: ActivityDto },
        },
      ],
    },
    authenticated: true,
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateActivityDto: UpdateActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActivityDto> {
    return this.activityService.update(id, updateActivityDto, user.id);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Delete an activity',
    response: {
      success: [
        { status: 'NO_CONTENT', description: 'Activity deleted successfully' },
      ],
    },
    authenticated: true,
    status: 'NO_CONTENT',
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.activityService.remove(user.id, id);
  }

  @PatchApi({
    path: 'move',
    summary: 'Move activity to another stage',
    description:
      'Moves an activity to a different stage within the same project',
    body: MoveActivityDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Activity moved successfully',
          schema: { dto: StatusResponseDto },
        },
      ],
    },
    authenticated: true,
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async move(
    @Body() moveDto: MoveActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ status: boolean; message: string }> {
    return this.activityService.move(
      moveDto.activityId,
      moveDto.targetStageId,
      user.id,
    );
  }

  @PatchApi({
    path: 'reorder',
    summary: 'Reorder activities',
    description: 'Updates the order of multiple activities',
    body: ReorderActivitiesDto,
    authenticated: true,
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async reorder(
    @Body() reorderDto: ReorderActivitiesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ status: boolean; message: string }> {
    return this.activityService.reorder(reorderDto.activities, user.id);
  }
}
