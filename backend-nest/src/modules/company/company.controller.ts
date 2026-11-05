import { Body, Controller, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { plainToInstance } from 'class-transformer';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyDto } from './dto/company.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactDto } from './dto/contact.dto';
import { AddCompanyMemberDto, InviteCompanyMemberDto, UpdateCompanyMemberDto } from './dto/add-member.dto';
import { FindAllCompanyUseCase } from './use-cases/find-all.use-case';
import { FindOneCompanyUseCase } from './use-cases/find-one.use-case';
import { CreateCompanyUseCase } from './use-cases/create.use-case';
import { UpdateCompanyUseCase } from './use-cases/update.use-case';
import { RemoveCompanyUseCase } from './use-cases/remove.use-case';
import { ListCompanyContactsUseCase } from './use-cases/list-company-contacts.use-case';
import { CreateCompanyContactUseCase } from './use-cases/create-company-contact.use-case';
import { UpdateCompanyContactUseCase } from './use-cases/update-company-contact.use-case';
import { ArchiveCompanyContactUseCase } from './use-cases/archive-company-contact.use-case';
import { ListCompanyMembersUseCase } from './use-cases/list-company-members.use-case';
import { AddCompanyMemberUseCase } from './use-cases/add-company-member.use-case';
import { RemoveCompanyMemberUseCase } from './use-cases/remove-company-member.use-case';
import { UpdateCompanyMemberUseCase } from './use-cases/update-company-member.use-case';
import { InviteCompanyMemberUseCase } from './use-cases/invite-company-member.use-case';
import { ListCompanyInvitesUseCase } from './use-cases/list-company-invites.use-case';
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
    private readonly listCompanyMembers: ListCompanyMembersUseCase,
    private readonly addCompanyMember: AddCompanyMemberUseCase,
    private readonly removeCompanyMember: RemoveCompanyMemberUseCase,
    private readonly updateCompanyMember: UpdateCompanyMemberUseCase,
    private readonly inviteCompanyMember: InviteCompanyMemberUseCase,
    private readonly listCompanyInvites: ListCompanyInvitesUseCase,
  ) {}

  @PostApi({
    summary: 'company.create.title',
    description: 'company.create.description',
    body: CreateCompanyDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Company created',
          schema: { dto: CompanyDto },
        },
      ],
    },
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
    response: {
      success: [
        {
          status: 'OK',
          description: 'Company found',
          schema: { dto: CompanyDto },
        },
      ],
    },
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
    response: {
      success: [
        {
          status: 'OK',
          description: 'Company updated',
          schema: { dto: CompanyDto },
        },
      ],
    },
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
    response: {
      success: [
        {
          status: 'OK',
          description: 'Company archived',
          schema: { dto: CompanyDto },
        },
      ],
    },
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
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Contact created',
          schema: { dto: ContactDto },
        },
      ],
    },
  })
  async createContact(
    @Param('id') id: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.createCompanyContact.execute(id, dto, currentUser);
  }

  @PatchApi({
    path: ':id/contacts/:contactId',
    summary: 'company.contacts.update.title',
    body: UpdateContactDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Contact updated',
          schema: { dto: ContactDto },
        },
      ],
    },
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
    response: {
      success: [
        {
          status: 'OK',
          description: 'Contact archived',
          schema: { dto: ContactDto },
        },
      ],
    },
  })
  async archiveContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.archiveCompanyContact.execute(id, contactId, currentUser);
  }

  @GetApi({
    path: ':id/members',
    summary: 'company.members.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    queries: commonPaginationQueries,
  })
  async listMembers(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.listCompanyMembers.execute(id, query);
  }

  @PostApi({
    path: ':id/members',
    summary: 'company.members.add.title',
    body: AddCompanyMemberDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddCompanyMemberDto,
  ) {
    return this.addCompanyMember.execute(id, dto);
  }

  @PostApi({
    path: ':id/members/invite',
    summary: 'company.members.invite.title',
    body: InviteCompanyMemberDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async inviteMember(
    @Param('id') id: string,
    @Body() dto: InviteCompanyMemberDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.inviteCompanyMember.execute(id, dto, currentUser.id);
  }

  @PatchApi({
    path: ':id/members/:membershipId',
    summary: 'company.members.update.title',
    body: UpdateCompanyMemberDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async updateMember(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateCompanyMemberDto,
  ) {
    return this.updateCompanyMember.execute(id, membershipId, dto);
  }

  @DeleteApi({
    path: ':id/members/:membershipId',
    summary: 'company.members.remove.title',
    status: 'NO_CONTENT',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async removeMember(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.removeCompanyMember.execute(id, membershipId);
  }

  @GetApi({
    path: ':id/invites',
    summary: 'company.members.invites.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
  })
  async listInvites(@Param('id') id: string) {
    return this.listCompanyInvites.execute(id);
  }
}
