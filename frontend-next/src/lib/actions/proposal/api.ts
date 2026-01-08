"use server";
import { GET, POST, PUT, ApiResponse } from '../../api/api';
import type { Proposal, CreateProposalDto, UpdateProposalContentDto } from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';

export async function getProposals(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Proposal> | Proposal[]>> {
  return await GET<PaginatedResponse<Proposal> | Proposal[]>('/proposals', {
    params,
  });
}

export async function getProposal(id: string): Promise<ApiResponse<Proposal>> {
  return await GET<Proposal>(`/proposals/${id}`);
}

export async function getPublicProposal(id: string): Promise<ApiResponse<Proposal>> {
  return await GET<Proposal>(`/proposals/public/${id}`);
}

export async function getProposalsByCompany(companyId: string): Promise<ApiResponse<Proposal[]>> {
  return await GET<Proposal[]>(`/proposals/company/${companyId}`);
}

export async function createProposal(data: CreateProposalDto): Promise<ApiResponse<Proposal>> {
  return await POST<Proposal>('/proposals', data);
}

export async function updateProposalContent(
  id: string,
  data: UpdateProposalContentDto
): Promise<ApiResponse<Proposal>> {
  // Permite atualizar name e content
  return await PUT<Proposal>(`/proposals/${id}/content`, data);
}

export async function sendProposal(id: string): Promise<ApiResponse<Proposal>> {
  return await POST<Proposal>(`/proposals/${id}/send`, {});
}

export async function approveProposal(id: string): Promise<ApiResponse<Proposal>> {
  return await POST<Proposal>(`/proposals/public/${id}/approve`, {});
}
