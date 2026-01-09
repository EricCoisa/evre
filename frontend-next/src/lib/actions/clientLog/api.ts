"use server"
import type { ClientLog } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
import { GET, ApiResponse } from '../../api/api';
    
export async function getClientLoggings(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<ClientLog> | ClientLog[]>> {
  return await GET<PaginatedResponse<ClientLog> | ClientLog[]>(`/clientLog`, { params });
}
