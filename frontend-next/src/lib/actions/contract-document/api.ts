"use server";
import { GET, POST, PUT, ApiResponse } from '../../api/api';
import type {
  ContractDocument,
  CreateContractDocumentDto,
  UpdateContractDocumentContentDto,
} from './types';
import type {
  PaginatedResponse,
  PaginationParams,
} from '@/lib/types/pagination.types';

export async function getContractDocuments(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<ContractDocument> | ContractDocument[]>> {
  return await GET<PaginatedResponse<ContractDocument> | ContractDocument[]>(
    '/contract-documents',
    {
      params,
    },
  );
}

export async function getContractDocument(
  id: string,
): Promise<ApiResponse<ContractDocument>> {
  return await GET<ContractDocument>(`/contract-documents/${id}`);
}

export async function getContractDocumentsByProject(
  projectId: string,
): Promise<ApiResponse<ContractDocument[]>> {
  return await GET<ContractDocument[]>(
    `/contract-documents/project/${projectId}`,
  );
}

export async function getApprovedContractDocumentsByProject(
  projectId: string,
): Promise<ApiResponse<ContractDocument>> {
  return await GET<ContractDocument>(
    `/contract-documents/approved-project/${projectId}`,
  );
}


export async function createContractDocument(
  data: CreateContractDocumentDto,
): Promise<ApiResponse<ContractDocument>> {
  return await POST<ContractDocument>('/contract-documents', data);
}

export async function updateContractDocumentContent(
  id: string,
  data: UpdateContractDocumentContentDto,
): Promise<ApiResponse<ContractDocument>> {
  return await PUT<ContractDocument>(`/contract-documents/${id}/content`, data);
}

export async function sendContractDocument(
  id: string,
): Promise<ApiResponse<ContractDocument>> {
  return await POST<ContractDocument>(`/contract-documents/${id}/send`, {});
}

export async function acceptContractDocument(
  id: string,
): Promise<ApiResponse<ContractDocument>> {
  return await POST<ContractDocument>(`/contract-documents/${id}/accept`, {});
}

export async function archiveContractDocument(
  id: string,
): Promise<ApiResponse<ContractDocument>> {
  return await POST<ContractDocument>(`/contract-documents/${id}/archive`, {});
}
