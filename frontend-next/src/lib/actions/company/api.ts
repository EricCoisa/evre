"use server";
// Thin adapter — wraps generated company functions, preserves ApiResponse<T> shape
import { getCompany as getCompanyFactory } from '@/lib/generated/company/company';
import type { ApiResponse } from '@/lib/api/api';
import type { Company, CreateCompanyDto, UpdateCompanyDto, Contact, CreateContactDto, UpdateContactDto } from './types';
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
  return wrap(() => api.companyControllerFindOne(id) as unknown as Promise<Company>);
}

export async function createCompany(
  data: CreateCompanyDto,
): Promise<ApiResponse<Company>> {
  return wrap(() => api.companyControllerCreate(data) as unknown as Promise<Company>);
}

export async function updateCompany(
  id: string,
  data: UpdateCompanyDto,
): Promise<ApiResponse<Company>> {
  return wrap(() => api.companyControllerUpdate(id, data) as unknown as Promise<Company>);
}

/** "Excluir" uma empresa arquiva no servidor — nada é apagado. */
export async function archiveCompany(id: string): Promise<ApiResponse<Company>> {
  return wrap(() => api.companyControllerRemove(id) as unknown as Promise<Company>);
}

export async function getCompanyContacts(companyId: string): Promise<ApiResponse<Contact[]>> {
  return wrap(() => api.companyControllerListContacts(companyId) as unknown as Promise<Contact[]>);
}

export async function createCompanyContact(
  companyId: string,
  data: CreateContactDto,
): Promise<ApiResponse<Contact>> {
  return wrap(() => api.companyControllerCreateContact(companyId, data) as unknown as Promise<Contact>);
}

export async function updateCompanyContact(
  companyId: string,
  contactId: string,
  data: UpdateContactDto,
): Promise<ApiResponse<Contact>> {
  return wrap(() => api.companyControllerUpdateContact(companyId, contactId, data) as unknown as Promise<Contact>);
}

/** "Excluir" um contato arquiva no servidor — nada é apagado. */
export async function archiveCompanyContact(
  companyId: string,
  contactId: string,
): Promise<ApiResponse<Contact>> {
  return wrap(() => api.companyControllerArchiveContact(companyId, contactId) as unknown as Promise<Contact>);
}
