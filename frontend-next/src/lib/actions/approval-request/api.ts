"use server"
import type { ApprovalRequest, CreateApprovalRequestDto, UpdateApprovalRequestDto } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
import { GET, POST, PATCH, DELETE, ApiResponse } from '../../api/api';
    
export async function getApprovalRequests(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<ApprovalRequest> | ApprovalRequest[]>> {
  return await GET<PaginatedResponse<ApprovalRequest> | ApprovalRequest[]>(`/approval-request`, { params });
}

export async function getApprovalRequest(id: string): Promise<ApiResponse<ApprovalRequest>> {
  return await GET<ApprovalRequest>(`/approval-request/${id}`);
}

export async function createApprovalRequest(data: CreateApprovalRequestDto): Promise<ApiResponse<ApprovalRequest>> {
  return await POST<ApprovalRequest>(`/approval-request`, data);
}

export async function updateApprovalRequest(id: string, data: UpdateApprovalRequestDto): Promise<ApiResponse<ApprovalRequest>> {
  return await PATCH<ApprovalRequest>(`/approval-request/${id}`, data);
}

export async function deleteApprovalRequest(id: string): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await DELETE<{ status: boolean; message: string }>(`/approval-request/${id}`);
}
