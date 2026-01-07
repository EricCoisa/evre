"use server"
import type { Logging } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
import { GET, ApiResponse } from '../../api/api';
    
export async function getLoggings(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Logging> | Logging[]>> {
  return await GET<PaginatedResponse<Logging> | Logging[]>(`/logging`, { params });
}
