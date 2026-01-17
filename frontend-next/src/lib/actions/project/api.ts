"use server";

import { GET, POST, PATCH, DELETE } from '@/lib/api/api';
import type { ApiResponse } from '@/lib/api/api';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  Stage,
  CreateStageDto,
  UpdateStageDto,
  UpdateStageStatusDto,
  ReorderStagesDto,
  Activity,
  CreateActivityDto,
  UpdateActivityDto,
  MoveActivityDto,
  ReorderActivitiesDto,
  Comment,
  CreateCommentDto,
  Approval,
  CreateApprovalDto,
  ProjectHistory,
} from './types';

// Project API
export async function getProjects(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Project> | Project[]>> {
  return await GET<PaginatedResponse<Project> | Project[]>('/project', {
    params: params || {},
  });
}

export async function getProject(id: string): Promise<ApiResponse<Project>> {
  return await GET<Project>(`/project/${id}`);
}

export async function createProject(
  data: CreateProjectDto,
): Promise<ApiResponse<Project>> {
  return await POST<Project>('/project', data);
}

export async function updateProject(
  id: string,
  data: UpdateProjectDto,
): Promise<ApiResponse<Project>> {
  return await PATCH<Project>(`/project/${id}`, data);
}

export async function deleteProject(
  id: string,
): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await DELETE<{ status: boolean; message: string }>(`/project/${id}`);
}

// Stage API
/**
 * @deprecated Use getActivitiesByStage instead
 */
export async function getStages(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Stage> | Stage[]>> {
  return await GET<PaginatedResponse<Stage> | Stage[]>('/stage', {
    params: params || {},
  });
}

export async function getStagesByProject(
  projectId: string,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Stage> | Stage[]>> {
  return await GET<PaginatedResponse<Stage> | Stage[]>(`/stage/project/${projectId}`, {
    params: params || {},
  });
}

export async function getStage(id: string): Promise<ApiResponse<Stage>> {
  return await GET<Stage>(`/stage/${id}`);
}

export async function createStage(
  data: CreateStageDto,
): Promise<ApiResponse<Stage>> {
  return await POST<Stage>('/stage', data);
}

export async function updateStage(
  id: string,
  data: UpdateStageDto,
): Promise<ApiResponse<Stage>> {
  return await PATCH<Stage>(`/stage/${id}`, data);
}

export async function updateStageStatus(
  id: string,
  data: UpdateStageStatusDto,
): Promise<ApiResponse<Stage>> {
  return await PATCH<Stage>(`/stage/${id}/status`, data);
}

export async function deleteStage(
  id: string,
): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await DELETE<{ status: boolean; message: string }>(`/stage/${id}`);
}

export async function reorderStages(
  data: ReorderStagesDto,
): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await PATCH<{ status: boolean; message: string }>('/stage/reorder', data);
}

/**
 * @deprecated Use getActivitiesByStage instead
 */
export async function getActivities(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Activity> | Activity[]>> {
  return await GET<PaginatedResponse<Activity> | Activity[]>('/activity', {
    params: params || {},
  });
}

// Activity API
export async function getActivitiesByStage(
  stageId: string,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Activity> | Activity[]>> {
  return await GET<PaginatedResponse<Activity> | Activity[]>(`/activity/stage/${stageId}`, {
    params: params || {},
  });
}

export async function getActivity(id: string): Promise<ApiResponse<Activity>> {
  return await GET<Activity>(`/activity/${id}`);
}

export async function createActivity(
  data: CreateActivityDto,
): Promise<ApiResponse<Activity>> {
  return await POST<Activity>('/activity', data);
}

export async function updateActivity(
  id: string,
  data: UpdateActivityDto,
): Promise<ApiResponse<Activity>> {
  return await PATCH<Activity>(`/activity/${id}`, data);
}

export async function deleteActivity(
  id: string,
): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await DELETE<{ status: boolean; message: string }>(`/activity/${id}`);
}

export async function moveActivity(
  data: MoveActivityDto,
): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await PATCH<{ status: boolean; message: string }>('/activity/move', data);
}

export async function reorderActivities(
  data: ReorderActivitiesDto,
): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await PATCH<{ status: boolean; message: string }>('/activity/reorder', data);
}

// Comment API
export async function getCommentsByEntity(
  entityType: string,
  entityId: string,
): Promise<ApiResponse<Comment[]>> {
  return await GET<Comment[]>(`/comment/${entityType}/${entityId}`);
}

export async function createComment(
  data: CreateCommentDto,
): Promise<ApiResponse<Comment>> {
  return await POST<Comment>('/comment', data);
}

export async function deleteComment(
  id: string,
): Promise<ApiResponse<{ status: boolean; message: string }>> {
  return await DELETE<{ status: boolean; message: string }>(`/comment/${id}`);
}

// Approval API
export async function getApprovalsByEntity(
  entityType: string,
  entityId: string,
): Promise<ApiResponse<Approval[]>> {
  return await GET<Approval[]>(`/approval/${entityType}/${entityId}`);
}

export async function getApprovalByRequest(
  approvalRequestId: string,
): Promise<ApiResponse<Approval | null>> {
  return await GET<Approval | null>(`/approval/by-request/${approvalRequestId}`);
}

export async function createApproval(
  data: CreateApprovalDto,
): Promise<ApiResponse<Approval>> {
  return await POST<Approval>('/approval', data);
}

// ProjectHistory API
export async function getHistoryByProject(
  projectId: string,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<ProjectHistory> | ProjectHistory[]>> {
  return await GET<PaginatedResponse<ProjectHistory> | ProjectHistory[]>(
    `/project-history/project/${projectId}`,
    { params: params || {} },
  );
}

// GetProjectStatus
export async function getProjectStatusList(): Promise<ApiResponse<string[]>> {
  return await GET<string[]>('/project/status');
}

// GetActivityStatus
export async function getActivityStatusList(): Promise<ApiResponse<string[]>> {
  return await GET<string[]>('/activity/status');
}

// GetStageStatus
export async function getStageStatusList(): Promise<ApiResponse<string[]>> {
  return await GET<string[]>('/stage/status');
}