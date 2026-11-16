"use server";

import { getLead } from '@/lib/generated/lead/lead';
import type { ApiResponse } from '@/lib/api/api';
import type { PaginationParams, PaginatedResponse } from '@/lib/types/pagination.types';
import type { LeadDto, LeadControllerFindAllParams, UpdateLeadStatusDto, CreateLeadDto } from '@/lib/generated/schemas';
import { normalizePaginationParams } from '../normalize-pagination-params';
import { wrapAs, wrap } from '../wrap';
import { CAPTCHA_TOKEN_HEADER } from '@/lib/api/captcha-header';

const api = getLead();

export async function getLeads(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<LeadDto> | LeadDto[]>> {
  return wrapAs(() => api.leadControllerFindAll(normalizePaginationParams<LeadControllerFindAllParams>(params)));
}

export async function updateLeadStatus(id: string, dto: UpdateLeadStatusDto): Promise<ApiResponse<void>> {
  return wrapAs(() => api.leadControllerUpdateStatus(id, dto));
}

export async function deleteLead(id: string): Promise<ApiResponse<void>> {
  return wrap(() => api.leadControllerRemove(id));
}

export async function createLead(dto: CreateLeadDto, captchaToken?: string | null): Promise<ApiResponse<void>> {
  return wrap(() =>
    api.leadControllerCreate(
      dto,
      captchaToken ? { headers: { [CAPTCHA_TOKEN_HEADER]: captchaToken } } : undefined,
    ),
  );
}
