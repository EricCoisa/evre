import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectDto } from './dto/project.dto';
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

@ApiTags('project')
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @GetApi({
    path: 'status',
    summary: 'Get list of project statuses',
    description: 'Returns a list of all possible project statuses',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Project statuses retrieved successfully',
        },
      ],
    },
    authenticated: true,
  })
  getStatusList(): string[] {
    return this.projectService.getStatusList();
  }

  @PostApi({
    path: '',
    summary: 'Create a new project',
    description:
      'Creates a new project. Only ADMIN users can perform this action.',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Project created successfully',
          schema: { dto: ProjectDto },
        },
      ],
    },
    authenticated: true,
    status: 'CREATED',
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDto> {
    return this.projectService.create(createProjectDto, user.id);
  }

  @GetApi({
    path: '',
    summary: 'List all projects',
    description: 'Returns a list of all projects',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Projects retrieved successfully',
          schema: { dto: ProjectDto, isArray: true, isPagination: true },
        },
      ],
    },
    authenticated: true,
    queries: commonPaginationQueries,
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponse<ProjectDto> | ProjectDto[]> {
    const result = await this.projectService.findAll(query, user);

    if (Array.isArray(result)) {
      return plainToInstance(ProjectDto, result);
    }

    return {
      ...result,
      data: plainToInstance(ProjectDto, result.data),
    };
  }

  @GetApi({
    path: ':id',
    summary: 'Get project by ID',
    description: 'Returns a specific project by its ID',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Project retrieved successfully',
          schema: { dto: ProjectDto },
        },
      ],
    },
    authenticated: true,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDto> {
    return this.projectService.findOne(id, user);
  }

  @PatchApi({
    path: ':id',
    summary: 'Update a project',
    description:
      'Updates an existing project. Only ADMIN users can perform this action.',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Project updated successfully',
          schema: { dto: ProjectDto },
        },
      ],
    },
    authenticated: true,
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDto> {
    return this.projectService.update(id, updateProjectDto, user.id);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Delete a project',
    description:
      'Deletes an existing project. Only ADMIN users can perform this action.',
    response: {
      success: [
        {
          status: 'NO_CONTENT',
          description: 'Project deleted successfully',
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
    await this.projectService.remove(user.id, id);
  }
}
