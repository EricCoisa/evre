import { Controller, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import { GetApi, PostApi } from '../../common/decorators/api-method.decorator';
import { I18nService } from 'nestjs-i18n';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { ClientLogService } from './clientLog.service';
import { ClientLog } from 'src/domain/clientLog/clientLog.entity';
import { CreateClientLogDto } from './dto/create-clientLog-dto';
import { ClientLogDto } from './dto/clientLog-dto';
import { WebhookAuthGuard } from '../../common/guards/webhook-auth.guard';
import {
  WebhookProjectData,
  type WebhookProject,
} from '../../common/decorators/webhook-project.decorator';

@ApiTags('clientLog')
@Controller('clientLog')
export class ClientLogController {
  constructor(
    private readonly clientLogService: ClientLogService,
    private readonly i18n: I18nService,
  ) {}

  @GetApi({
    summary: 'Lista logs de client',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: { dto: ClientLog, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<ClientLogDto> | ClientLogDto[]> {
    return await this.clientLogService.findAll(query);
  }

  @PostApi({
    path: 'webhook',
    summary: 'Register a client log via webhook',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Client log created successfully',
          schema: { dto: ClientLog },
        },
      ],
    },
    authenticated: false, // Usa autenticação customizada via guard
    status: 'CREATED',
  })
  @UseGuards(WebhookAuthGuard)
  @ApiHeader({
    name: 'x-project-id',
    description: 'Project ID for webhook authentication',
    required: true,
  })
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token for webhook authentication',
    required: true,
  })
  async create(
    @Body() createClientLogDto: CreateClientLogDto,
    @WebhookProjectData() project: WebhookProject,
  ): Promise<ClientLog> {
    return this.clientLogService.create(
      createClientLogDto,
      project.id,
      project.companyId,
    );
  }
}
