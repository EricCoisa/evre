export type {
  ProjectDto as Project,
  CreateProjectDto,
  UpdateProjectDto,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  CreateCommentDto,
  RequestApprovalDto,
  RespondApprovalDto,
  CreateInfoRequestDto,
  AnswerInfoRequestDto,
  ProjectControllerFindAllParams,
  ProjectControllerGetCommentsParams,
} from '@/lib/generated/schemas';

export interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  position: number;
  tasks: MilestoneTask[];
}

export interface MilestoneTask {
  id: string;
  title: string;
  description?: string | null;
  position: number;
}

export interface InfoRequest {
  id: string;
  label: string;
  description?: string;
  status: 'PENDING' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED' | string;
  requestedBy?: { name?: string };
  createdAt: string;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  entityType: 'PROJECT' | 'MILESTONE' | 'TASK';
  entityId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    name?: string | null;
    imageUrl?: string | null;
  };
}

export interface MilestoneApproval {
  id: string;
  milestoneId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedById: string;
  respondedById?: string | null;
  requestNote?: string | null;
  responseNote?: string | null;
  requestedAt: string;
  respondedAt?: string | null;
  requestedBy?: { id: string; name: string };
  respondedBy?: { id: string; name: string } | null;
}
