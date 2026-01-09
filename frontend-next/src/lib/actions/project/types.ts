// Project Types
export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: string;
  token: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  companyId: string;
  name: string;
  description?: string;
  status?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: string;
}

export const ProjectStatusColors = {
  PROPOSAL: 'bg-blue-100 text-blue-800',
  REQUIREMENTS: 'bg-yellow-100 text-yellow-800',
  DEVELOPMENT: 'bg-purple-100 text-purple-800',
  DONE: 'bg-green-100 text-green-800',
};

// Stage Types
export type StageStatus = 'TODO' | 'DOING' | 'DONE';

export interface Stage {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: StageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStageDto {
  projectId: string;
  name: string;
  order: number;
  status?: StageStatus;
}

export interface UpdateStageDto {
  name?: string;
  order?: number;
  status?: StageStatus;
}

export interface UpdateStageStatusDto {
  status: StageStatus;
}

export interface ReorderStagesDto {
  stages: Array<{
    stageId: string;
    order: number;
  }>;
}

// Activity Types
export interface Activity {
  id: string;
  stageId: string;
  title: string;
  description: string | null;
  status: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityDto {
  stageId: string;
  title: string;
  description?: string;
  status?: string;
}

export interface UpdateActivityDto {
  title?: string;
  description?: string;
  status?: string;
  order?: number;
}

export interface MoveActivityDto {
  activityId: string;
  targetStageId: string;
}

export interface ReorderActivitiesDto {
  activities: Array<{
    activityId: string;
    order: number;
  }>;
}

// Comment Types
export type CommentEntityType = 'PROJECT' | 'STAGE' | 'ACTIVITY';

export interface Comment {
  id: string;
  projectId: string;
  entityType: CommentEntityType;
  entityId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface CreateCommentDto {
  projectId: string;
  entityType: CommentEntityType;
  entityId: string;
  content: string;
}

// Approval Types
export type ApprovalEntityType = 'STAGE';

export interface Approval {
  id: string;
  projectId: string;
  entityType: ApprovalEntityType;
  entityId: string;
  userId: string;
  status: ApprovalStatus;
  comment: string | null;
  createdAt: string;
}

export type ApprovalStatus = 'APPROVED' | 'REJECTED';

export interface CreateApprovalDto {
  projectId: string;
  entityType: ApprovalEntityType;
  entityId: string;
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

export type ProjectHistoryType = 
  | 'STATUS_CHANGE' 
  | 'COMMENT' 
  | 'APPROVAL' 
  | 'STAGE_CREATED' 
  | 'STAGE_UPDATED' 
  | 'STAGE_DELETED' 
  | 'STAGE_REORDERED' 
  | 'ACTIVITY_CREATED' 
  | 'ACTIVITY_UPDATED' 
  | 'ACTIVITY_DELETED' 
  | 'ACTIVITY_MOVED';

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
