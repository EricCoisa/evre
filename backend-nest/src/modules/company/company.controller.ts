import { Body, Controller, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { plainToInstance } from 'class-transformer';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
  PutApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyDto } from './dto/company.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactDto } from './dto/contact.dto';
import { FindAllCompanyUseCase } from './use-cases/find-all.use-case';
import { FindOneCompanyUseCase } from './use-cases/find-one.use-case';
import { CreateCompanyUseCase } from './use-cases/create.use-case';
import { UpdateCompanyUseCase } from './use-cases/update.use-case';
import { RemoveCompanyUseCase } from './use-cases/remove.use-case';
import { ListCompanyContactsUseCase } from './use-cases/list-company-contacts.use-case';
import { CreateCompanyContactUseCase } from './use-cases/create-company-contact.use-case';
import { UpdateCompanyContactUseCase } from './use-cases/update-company-contact.use-case';
import { ArchiveCompanyContactUseCase } from './use-cases/archive-company-contact.use-case';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import {
  type PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';

@ApiTags('company')
@Controller('company')
export class CompanyController {
  constructor(
    private readonly findAllCompany: FindAllCompanyUseCase,
    private readonly findOneCompany: FindOneCompanyUseCase,
    private readonly createCompany: CreateCompanyUseCase,
    private readonly updateCompany: UpdateCompanyUseCase,
    private readonly removeCompany: RemoveCompanyUseCase,
    private readonly listCompanyContacts: ListCompanyContactsUseCase,
    private readonly createCompanyContact: CreateCompanyContactUseCase,
    private readonly updateCompanyContact: UpdateCompanyContactUseCase,
    private readonly archiveCompanyContact: ArchiveCompanyContactUseCase,
  ) {}

  @PostApi({
    summary: 'company.create.title',
    description: 'company.create.description',
    body: CreateCompanyDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.createCompany.execute(dto, currentUser.id);
  }

  @GetApi({
    summary: 'company.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Paginated response',
          schema: { dto: CompanyDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponse<CompanyDto> | CompanyDto[]> {
    const result = await this.findAllCompany.execute(query, currentUser);

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
    summary: 'company.find.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.findOneCompany.execute(id, currentUser);
  }

  @PatchApi({
    path: ':id',
    summary: 'company.update.title',
    body: UpdateCompanyDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.updateCompany.execute(id, dto, currentUser);
  }

  @DeleteApi({
    path: ':id',
    summary: 'company.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.removeCompany.execute(id, currentUser);
  }

  @GetApi({
    path: ':id/contacts',
    summary: 'company.contacts.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Contacts of the company',
          schema: { dto: ContactDto, isArray: true },
        },
      ],
    },
  })
  async listContacts(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.listCompanyContacts.execute(id, currentUser);
  }

  @PostApi({
    path: ':id/contacts',
    summary: 'company.contacts.create.title',
    body: CreateContactDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async createContact(
    @Param('id') id: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.createCompanyContact.execute(id, dto, currentUser);
  }

  @PutApi({
    path: ':id/contacts/:contactId',
    summary: 'company.contacts.update.title',
    body: UpdateContactDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.updateCompanyContact.execute(id, contactId, dto, currentUser);
  }

  @DeleteApi({
    path: ':id/contacts/:contactId',
    summary: 'company.contacts.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async archiveContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.archiveCompanyContact.execute(id, contactId, currentUser);
  }
}
