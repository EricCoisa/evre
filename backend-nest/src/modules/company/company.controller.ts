import {
  Controller,
  Body,
  Param,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyDto } from './dto/company.dto';
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

@ApiTags('company')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @PostApi({
    path: '',
    summary: 'Create a new company',
    description:
      'Creates a new company. Only ADMIN users can perform this action.',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Company created successfully',
          schema: { dto: CompanyDto },
        },
      ],
    },
    authenticated: true,
    status: 'CREATED',
    roles: ['ADMIN'],
  })
  @Roles('ADMIN')
  async create(
    @Body() createCompanyDto: CreateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompanyDto> {
    return this.companyService.create(createCompanyDto, user.id);
  }

  @GetApi({
    path: '',
    summary: 'List all companies',
    description: 'Returns a list of all companies',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Companies retrieved successfully',
          schema: { dto: CompanyDto, isArray: true, isPagination: true },
        },
      ],
    },
    authenticated: true,
    queries: commonPaginationQueries,
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<CompanyDto> | CompanyDto[]> {
    const result = await this.companyService.findAll(query);

    if (Array.isArray(result)) {
      return plainToInstance(CompanyDto, result);
    }

    return {
      data: plainToInstance(CompanyDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @GetApi({
    path: ':id',
    summary: 'Get company by ID',
    description: 'Returns a specific company by its ID',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Company retrieved successfully',
          schema: { dto: CompanyDto },
        },
      ],
    },
    authenticated: true,
  })
  async findOne(@Param('id') id: string): Promise<CompanyDto> {
    const company = await this.companyService.findOne(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  @PatchApi({
    path: ':id',
    summary: 'Update company',
    description:
      'Updates an existing company. Only ADMIN users can perform this action.',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Company updated successfully',
          schema: { dto: CompanyDto },
        },
      ],
    },
    authenticated: true,
  })
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompanyDto> {
    return this.companyService.update(id, updateCompanyDto, user.id);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Delete company',
    description: 'Deletes a company. Only ADMIN users can perform this action.',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Company deleted successfully',
        },
      ],
    },
    authenticated: true,
  })
  @Roles('ADMIN')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ status: boolean; message: string }> {
    return this.companyService.remove(user.id, id);
  }
}
