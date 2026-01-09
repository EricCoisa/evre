import { ContractStatus } from './contractStatus.const';

export interface ContractDocument {
  id: string;
  projectId: string;
  proposalId: string | null;
  name: string;
  version: number;
  status: ContractStatus;
  contentSchemaVersion: string;
  content: string; // JSON armazenado como string
  createdAt: Date;
  updatedAt: Date;
}
