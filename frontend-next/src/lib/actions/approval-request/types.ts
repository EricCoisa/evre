export interface ApprovalRequest {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApprovalRequestDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateApprovalRequestDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export const ApprovalRequestStatusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};
