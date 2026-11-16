import { Body, Controller, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { plainToInstance } from 'class-transformer';
import { UseGuards } from '@nestjs/common';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CaptchaGuard, RequireCaptcha } from '../captcha/captcha.guard';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { LeadDto } from './dto/lead.dto';
import { CreateLeadUseCase } from './use-cases/create-lead.use-case';
import { ListLeadsUseCase } from './use-cases/list-leads.use-case';
import { UpdateLeadStatusUseCase } from './use-cases/update-lead-status.use-case';
import { DeleteLeadUseCase } from './use-cases/delete-lead.use-case';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import {
  type PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';

@ApiTags('lead')
@Controller('lead')
export class LeadController {
  constructor(
    private readonly createLead: CreateLeadUseCase,
    private readonly listLeads: ListLeadsUseCase,
    private readonly updateLeadStatus: UpdateLeadStatusUseCase,
    private readonly deleteLead: DeleteLeadUseCase,
  ) {}

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(CaptchaGuard)
  @RequireCaptcha()
  @PostApi({
    summary: 'lead.create.title',
    description: 'lead.create.description',
    body: CreateLeadDto,
    status: 'CREATED',
    authenticated: false,
    response: {
      success: [
        { status: 'CREATED', description: 'Lead recebido com sucesso' },
      ],
    },
  })
  async create(@Body() dto: CreateLeadDto): Promise<LeadDto> {
    const result = await this.createLead.execute(dto);
    return plainToInstance(LeadDto, result);
  }

  @GetApi({
    summary: 'lead.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Paginated response',
          schema: { dto: LeadDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<LeadDto> | LeadDto[]> {
    const result = await this.listLeads.execute(query);

    if (Array.isArray(result)) {
      return plainToInstance(LeadDto, result);
    }

    return {
      data: plainToInstance(LeadDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @DeleteApi({
    path: ':id',
    summary: 'lead.delete.title',
    status: 'NO_CONTENT',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteLead.execute(id, currentUser);
  }

  @PatchApi({
    path: ':id/status',
    summary: 'lead.update_status.title',
    body: UpdateLeadStatusDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<LeadDto> {
    const result = await this.updateLeadStatus.execute(id, dto, currentUser.id);
    return plainToInstance(LeadDto, result);
  }
}
