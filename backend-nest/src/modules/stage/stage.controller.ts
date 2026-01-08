import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StageService } from './stage.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { StageDto } from './dto/stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';
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

@ApiTags('stage')
@Controller('stage')
export class StageController {
  constructor(private readonly stageService: StageService) {}

  @PostApi({
    path: '',
    summary: 'Create a new stage',
    description: 'Creates a new stage for a project',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Stage created successfully',
          schema: { dto: StageDto },
        },
      ],
    },
    authenticated: true,
    status: 'CREATED',
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async create(
    @Body() createStageDto: CreateStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StageDto> {
    return this.stageService.create(createStageDto, user.id);
  }

  @GetApi({
    path: '',
    summary: 'List all stages',
    description: 'Returns a list of all stages',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Stages retrieved successfully',
          schema: { dto: StageDto, isArray: true, isPagination: true },
        },
      ],
    },
    authenticated: true,
    queries: commonPaginationQueries,
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<StageDto> | StageDto[]> {
    const result = await this.stageService.findAll(query);

    if (Array.isArray(result)) {
      return plainToInstance(StageDto, result);
    }

    return {
      ...result,
      data: plainToInstance(StageDto, result.data),
    };
  }

  @GetApi({
    path: ':id',
    summary: 'Get stage by ID',
    description: 'Returns a specific stage by its ID',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Stage retrieved successfully',
          schema: { dto: StageDto },
        },
      ],
    },
    authenticated: true,
  })
  async findOne(@Param('id') id: string): Promise<StageDto> {
    return this.stageService.findOne(id);
  }

  @PatchApi({
    path: ':id',
    summary: 'Update a stage',
    description: 'Updates an existing stage',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Stage updated successfully',
          schema: { dto: StageDto },
        },
      ],
    },
    authenticated: true,
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateStageDto: UpdateStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StageDto> {
    return this.stageService.update(id, updateStageDto, user.id);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Delete a stage',
    description: 'Deletes an existing stage',
    response: {
      success: [
        {
          status: 'NO_CONTENT',
          description: 'Stage deleted successfully',
        },
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
    await this.stageService.remove(user.id, id);
  }

  @PatchApi({
    path: 'reorder',
    summary: 'Reorder stages',
    description: 'Reorders stages within a project',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Stages reordered successfully',
          schema: { dto: StatusResponseDto },
        },
      ],
    },
    authenticated: true,
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async reorder(
    @Body() reorderDto: ReorderStagesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ status: boolean; message: string }> {
    return this.stageService.reorder(reorderDto.stages, user.id);
  }
}
