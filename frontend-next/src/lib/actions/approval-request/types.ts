export enum ApprovalRequestStatus {
  PENDING = 'PENDING',
  ANSWERED = 'ANSWERED',
  CANCELED = 'CANCELED',
}

export interface ApprovalRequest {
  id: string;
  projectId: string;
  stageId: string;
  requestedById: string;
  status: ApprovalRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  project?: {
    id: string;
    name: string;
  };
  stage?: {
    id: string;
    name: string;
  };
  requestedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateApprovalRequestDto {
  projectId: string;
  stageId: string;
}

export interface UpdateApprovalRequestDto {
  status?: ApprovalRequestStatus;
}

export const ApprovalRequestStatusColors: Record<ApprovalRequestStatus, string> = {
  [ApprovalRequestStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
  [ApprovalRequestStatus.ANSWERED]: 'bg-green-100 text-green-800',
  [ApprovalRequestStatus.CANCELED]: 'bg-gray-100 text-gray-800',
};
