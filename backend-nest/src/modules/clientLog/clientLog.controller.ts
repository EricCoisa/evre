import { Controller, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
    summary: 'Register a client log',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Client log created successfully',
          schema: { dto: ClientLog },
        },
      ],
    },
    authenticated: true,
    status: 'CREATED',
  })
  async create(
    @Body() createClientLogDto: CreateClientLogDto,
  ): Promise<ClientLog> {
    return this.clientLogService.create(createClientLogDto);
  }
}
