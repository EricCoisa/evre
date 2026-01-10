import { Controller, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectHistoryService } from './project-history.service';
import { ProjectHistoryDto } from './dto/project-history.dto';
import { GetApi } from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { PaginatedResponse } from '../../common/types/pagination.types';

@ApiTags('project-history')
@Controller('project-history')
export class ProjectHistoryController {
  constructor(private readonly projectHistoryService: ProjectHistoryService) {}

  @GetApi({
    path: 'project/:projectId',
    summary: 'Get history by project',
    response: {
      success: [
        {
          status: 'OK',
          description: 'History retrieved successfully',
          schema: { dto: ProjectHistoryDto, isArray: true, isPagination: true },
        },
      ],
    },
    authenticated: true,
    queries: commonPaginationQueries,
  })
  async findByProject(
    @Param('projectId') projectId: string,
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponse<ProjectHistoryDto> | ProjectHistoryDto[]> {
    return this.projectHistoryService.findByProject(projectId, query, user);
  }
}
