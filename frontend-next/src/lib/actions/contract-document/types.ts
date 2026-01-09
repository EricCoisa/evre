export type ContractStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'ARCHIVED';

export interface ContractDocument {
  id: string;
  projectId: string;
  proposalId: string | null;
  name: string;
  version: number;
  status: ContractStatus;
  contentSchemaVersion: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractDocumentDto {
  projectId: string;
  proposalId?: string;
  name: string;
  content: string;
  contentSchemaVersion?: string;
}

export interface UpdateContractDocumentContentDto {
  name?: string;
  content: string;
}

export const ContractStatusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-slate-100 text-slate-800',
};
