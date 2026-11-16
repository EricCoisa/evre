"use server";

import { getLead } from '@/lib/generated/lead/lead';
import type { ApiResponse } from '@/lib/api/api';
import type { PaginationParams, PaginatedResponse } from '@/lib/types/pagination.types';
import type { LeadDto, LeadControllerFindAllParams, UpdateLeadStatusDto } from '@/lib/generated/schemas';
import { normalizePaginationParams } from '../normalize-pagination-params';
import { wrapAs } from '../wrap';

const api = getLead();

export async function getLeads(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<LeadDto> | LeadDto[]>> {
  return wrapAs(() => api.leadControllerFindAll(normalizePaginationParams<LeadControllerFindAllParams>(params)));
}

export async function updateLeadStatus(id: string, dto: UpdateLeadStatusDto): Promise<ApiResponse<void>> {
  return wrapAs(() => api.leadControllerUpdateStatus(id, dto));
}
