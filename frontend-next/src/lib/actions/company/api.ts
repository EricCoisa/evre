"use server";
import { GET, POST, PATCH, ApiResponse } from '../../api/api';
import type { Company, CreateCompanyDto, UpdateCompanyDto } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';

export async function getCompanies(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Company> | Company[]>> {
  return await GET<PaginatedResponse<Company> | Company[]>('/companies', {
    params,
  });
}

export async function getCompany(id: string): Promise<ApiResponse<Company>> {
  return await GET<Company>(`/companies/${id}`);
}

export async function createCompany(data: CreateCompanyDto): Promise<ApiResponse<Company>> {
  return await POST<Company>('/companies', data);
}

export async function updateCompany(id: string, data: UpdateCompanyDto): Promise<ApiResponse<Company>> {
  return await PATCH<Company>(`/companies/${id}`, data);
}
