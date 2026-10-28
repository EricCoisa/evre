import { Controller, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetApi } from '../../common/decorators/api-method.decorator';
import { I18nService } from 'nestjs-i18n';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PAGINATION_PAGE_SOURCE_PARAMS,
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { FindAllLogsUseCase } from './use-cases/find-all.use-case';
import { Logging } from 'src/domain/logging/logging.entity';

@ApiTags('logging')
@Controller('logging')
export class LoggingController {
  constructor(
    private readonly findAllLogs: FindAllLogsUseCase,
    private readonly i18n: I18nService,
  ) {}

  @GetApi({
    summary: 'Lista logs',
    status: 'OK',
    roles: ['ADMIN', 'MODERATOR'],
    queries: commonPaginationQueries,
    pageSource: {
      key: 'logs.list',
      kind: 'list',
      description: 'Logs de auditoria do sistema.',
      fields: ['module', 'action', 'message', 'createdAt'],
      params: PAGINATION_PAGE_SOURCE_PARAMS,
    },
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: { dto: Logging, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<Logging> | Logging[]> {
    return await this.findAllLogs.execute(query);
  }
}
