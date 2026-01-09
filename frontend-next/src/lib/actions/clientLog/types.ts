export interface ClientLog {
  id: string;
  companyId: string;
  companyName: string;
  projectId: string;
  projectName: string;
  environment: string;
  metadata?: string | null;
  createdAt: Date;
}