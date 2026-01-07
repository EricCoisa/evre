export type ProposalStatus = 'DRAFT' | 'SENT' | 'APPROVED';

export interface Proposal {
  id: string;
  companyId: string;
  status: ProposalStatus;
  contentSchemaVersion: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalDto {
  companyId: string;
  content: string;
  contentSchemaVersion?: string;
}

export interface UpdateProposalContentDto {
  content: string;
}

export const ProposalStatusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
};
