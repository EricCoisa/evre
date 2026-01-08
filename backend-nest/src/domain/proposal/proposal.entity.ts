import { ProposalStatus } from './proposalStatus.const';

export interface Proposal {
  id: string;
  companyId: string;
  name: string;
  status: ProposalStatus;
  contentSchemaVersion: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
