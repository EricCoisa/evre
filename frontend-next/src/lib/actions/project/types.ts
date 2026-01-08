// Project Types
export interface Project {
  id: string;
  companyId: string;
  proposalId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'PROPOSAL' | 'REQUIREMENTS' | 'DEVELOPMENT' | 'DONE';

export interface CreateProjectDto {
  companyId: string;
  proposalId?: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
}

export interface UpdateProjectDto {
  proposalId?: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export const ProjectStatusColors = {
  PROPOSAL: 'bg-blue-100 text-blue-800',
  REQUIREMENTS: 'bg-yellow-100 text-yellow-800',
  DEVELOPMENT: 'bg-purple-100 text-purple-800',
  DONE: 'bg-green-100 text-green-800',
};

// Stage Types
export interface Stage {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStageDto {
  projectId: string;
  name: string;
  order: number;
  status?: string;
}

export interface UpdateStageDto {
  name?: string;
  order?: number;
  status?: string;
}

// Activity Types
export interface Activity {
  id: string;
  stageId: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;
}

export type ActivityStatus = 'TODO' | 'DOING' | 'DONE';

export interface CreateActivityDto {
  stageId: string;
  title: string;
  description?: string;
  status?: ActivityStatus;
}

export interface UpdateActivityDto {
  title?: string;
  description?: string;
  status?: ActivityStatus;
}

export const ActivityStatusColors = {
  TODO: 'bg-gray-100 text-gray-800',
  DOING: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
};

// Comment Types
export interface Comment {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface CreateCommentDto {
  projectId: string;
  content: string;
}

// Approval Types
export interface Approval {
  id: string;
  stageId: string;
  userId: string;
  status: ApprovalStatus;
  comment: string | null;
  createdAt: string;
}

export type ApprovalStatus = 'APPROVED' | 'REJECTED';

export interface CreateApprovalDto {
  stageId: string;
  status: ApprovalStatus;
  comment?: string;
}

export const ApprovalStatusColors = {
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

// ProjectHistory Types
export interface ProjectHistory {
  id: string;
  projectId: string;
  type: ProjectHistoryType;
  payload: string;
  createdAt: string;
}

export type ProjectHistoryType = 'STATUS_CHANGE' | 'COMMENT' | 'APPROVAL';

// With Relations
export interface ProjectWithDetails extends Project {
  stages?: Stage[];
  comments?: Comment[];
  histories?: ProjectHistory[];
}

export interface StageWithActivities extends Stage {
  activities?: Activity[];
  approvals?: Approval[];
}
