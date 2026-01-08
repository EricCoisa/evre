import { Controller, Param, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectHistoryService } from './project-history.service';
import { ProjectHistoryDto } from './dto/project-history.dto';
import { GetApi } from '../../common/decorators/api-method.decorator';

@ApiTags('project-history')
@Controller('project-history')
export class ProjectHistoryController {
  constructor(private readonly projectHistoryService: ProjectHistoryService) {}

  @GetApi({
    path: 'project/:projectId',
    summary: 'Get history by project',
    response: { success: [{ status: 'OK', description: 'History retrieved successfully', schema: { dto: ProjectHistoryDto, isArray: true } }] },
    authenticated: true,
  })
  async findByProject(@Param('projectId') projectId: string): Promise<ProjectHistoryDto[]> {
    return this.projectHistoryService.findByProject(projectId);
  }
}
