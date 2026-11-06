export type {
  ProjectDto as Project,
  CreateProjectDto,
  UpdateProjectDto,
  CreateCommentDto,
  RespondApprovalDto,
  CreateInfoRequestDto,
  AnswerInfoRequestDto,
  ProjectControllerFindAllParams,
  ProjectControllerGetCommentsParams,
} from '@/lib/generated/schemas';

export interface Milestone {
  id: string;
  title: string;
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
  status: string;
  requestedBy?: { name?: string };
  createdAt: string;
}
