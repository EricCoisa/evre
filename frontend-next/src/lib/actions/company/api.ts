"use server";
// Thin adapter — wraps generated company functions, preserves ApiResponse<T> shape
import { getCompany as getCompanyFactory } from '@/lib/generated/company/company';
import type { ApiResponse } from '@/lib/api/api';
import type { Company, CreateCompanyDto, UpdateCompanyDto, Contact, CreateContactDto, UpdateContactDto, AddCompanyMemberDto, InviteCompanyMemberDto, UpdateCompanyMemberDto } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
import type { CompanyControllerFindAllParams } from '@/lib/generated/schemas';
import { normalizePaginationParams } from '../normalize-pagination-params';
import { wrap, wrapAs } from '../wrap';

const api = getCompanyFactory();

export async function getCompanys(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Company> | Company[]>> {
  return wrapAs(() =>
    api.companyControllerFindAll(
      normalizePaginationParams<CompanyControllerFindAllParams>(params),
    ),
  );
}

export async function getCompany(id: string): Promise<ApiResponse<Company>> {
  return wrap(() => api.companyControllerFindOne(id));
}

export async function createCompany(
  data: CreateCompanyDto,
): Promise<ApiResponse<Company>> {
  return wrap(() => api.companyControllerCreate(data));
}

export async function updateCompany(
  id: string,
  data: UpdateCompanyDto,
): Promise<ApiResponse<Company>> {
  return wrap(() => api.companyControllerUpdate(id, data));
}

/** "Excluir" uma empresa arquiva no servidor — nada é apagado. */
export async function archiveCompany(id: string): Promise<ApiResponse<Company>> {
  return wrap(() => api.companyControllerRemove(id));
}

export async function getCompanyContacts(companyId: string): Promise<ApiResponse<Contact[]>> {
  return wrap(() => api.companyControllerListContacts(companyId));
}

export async function createCompanyContact(
  companyId: string,
  data: CreateContactDto,
): Promise<ApiResponse<Contact>> {
  return wrap(() => api.companyControllerCreateContact(companyId, data));
}

export async function updateCompanyContact(
  companyId: string,
  contactId: string,
  data: UpdateContactDto,
): Promise<ApiResponse<Contact>> {
  return wrap(() => api.companyControllerUpdateContact(companyId, contactId, data));
}

/** "Excluir" um contato arquiva no servidor — nada é apagado. */
export async function archiveCompanyContact(
  companyId: string,
  contactId: string,
): Promise<ApiResponse<Contact>> {
  return wrap(() => api.companyControllerArchiveContact(companyId, contactId));
}

export async function getCompanyMembers(
  companyId: string,
  params?: PaginationParams,
): Promise<ApiResponse<unknown>> {
  return wrapAs(() =>
    api.companyControllerListMembers(
      companyId,
      normalizePaginationParams(params),
    ),
  );
}

export async function getCompanyInvites(companyId: string): Promise<ApiResponse<unknown>> {
  return wrap(() => api.companyControllerListInvites(companyId));
}

export async function addCompanyMember(
  companyId: string,
  data: AddCompanyMemberDto,
): Promise<ApiResponse<unknown>> {
  return wrap(() => api.companyControllerAddMember(companyId, data));
}

export async function inviteCompanyMember(
  companyId: string,
  data: InviteCompanyMemberDto,
): Promise<ApiResponse<unknown>> {
  return wrap(() => api.companyControllerInviteMember(companyId, data));
}

export async function updateCompanyMember(
  companyId: string,
  membershipId: string,
  data: UpdateCompanyMemberDto,
): Promise<ApiResponse<unknown>> {
  const { customInstance } = await import('@/lib/api/orval-instance');
  return wrap(() =>
    customInstance({ url: `/company/${companyId}/members/${membershipId}`, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, data }),
  );
}

export async function removeCompanyMember(
  companyId: string,
  membershipId: string,
): Promise<ApiResponse<void>> {
  return wrap(() => api.companyControllerRemoveMember(companyId, membershipId) as unknown as Promise<void>);
}
