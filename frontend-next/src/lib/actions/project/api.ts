"use server";
import { getProject as getProjectFactory } from '@/lib/generated/project/project';
import type { ApiResponse } from '@/lib/api/api';
import type {
  Project, CreateProjectDto, UpdateProjectDto,
  CreateCommentDto, RespondApprovalDto, RequestApprovalDto,
  CreateInfoRequestDto, AnswerInfoRequestDto,
  ProjectControllerGetCommentsParams,
  Milestone, InfoRequest,
} from './types';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
import type { ProjectControllerFindAllParams } from '@/lib/generated/schemas';
import { normalizePaginationParams } from '../normalize-pagination-params';
import { wrap, wrapAs } from '../wrap';

const api = getProjectFactory();

export async function getProjects(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Project> | Project[]>> {
  return wrapAs(() =>
    api.projectControllerFindAll(
      normalizePaginationParams<ProjectControllerFindAllParams>(params),
    ),
  );
}

export async function getProject(id: string): Promise<ApiResponse<Project>> {
  return wrap(() => api.projectControllerFindOne(id));
}

export async function createProject(
  data: CreateProjectDto,
): Promise<ApiResponse<Project>> {
  return wrap(() => api.projectControllerCreate(data));
}

export async function updateProject(
  id: string,
  data: UpdateProjectDto,
): Promise<ApiResponse<Project>> {
  return wrap(() => api.projectControllerUpdate(id, data));
}

export async function archiveProject(id: string): Promise<ApiResponse<Project>> {
  return wrap(() => api.projectControllerRemove(id));
}

// Board
export async function getProjectBoard(id: string): Promise<ApiResponse<Milestone[] | { data: Milestone[] }>> {
  return wrapAs<Milestone[] | { data: Milestone[] }>(() => api.projectControllerBoard(id));
}

// Milestones
export async function createMilestone(projectId: string, data: { title: string; description?: string }) {
  return wrap(() => api.projectControllerAddMilestone(projectId, data));
}

export async function updateMilestone(projectId: string, milestoneId: string, data: { title?: string; description?: string }) {
  return wrap(() => api.projectControllerEditMilestone(projectId, milestoneId, data));
}

export async function deleteMilestone(projectId: string, milestoneId: string) {
  return wrap(() => api.projectControllerDeleteMilestone(projectId, milestoneId));
}

export async function reorderMilestones(projectId: string, orderedIds: string[]) {
  return wrap(() => api.projectControllerReorderMilestonesEndpoint(projectId, { orderedIds }));
}

// Tasks
export async function createTask(projectId: string, milestoneId: string, data: { title: string; description?: string }) {
  return wrap(() => api.projectControllerAddTask(projectId, milestoneId, data));
}

export async function updateTask(projectId: string, taskId: string, data: { title?: string; description?: string }) {
  return wrap(() => api.projectControllerEditTask(projectId, taskId, data));
}

export async function deleteTask(projectId: string, taskId: string) {
  return wrap(() => api.projectControllerDeleteTask(projectId, taskId));
}

export async function moveTask(projectId: string, taskId: string, data: { milestoneId: string; position: number }) {
  return wrap(() => api.projectControllerMoveTaskEndpoint(projectId, taskId, data));
}

export async function reorderTasks(projectId: string, milestoneId: string, orderedIds: string[]) {
  return wrap(() => api.projectControllerReorderTasksEndpoint(projectId, milestoneId, { orderedIds }));
}

// Comments
export async function createComment(projectId: string, data: CreateCommentDto) {
  return wrap(() => api.projectControllerAddComment(projectId, data));
}

export async function getComments(projectId: string, params: ProjectControllerGetCommentsParams) {
  return wrap(() => api.projectControllerGetComments(projectId, params));
}

export async function deleteComment(projectId: string, commentId: string) {
  return wrap(() => api.projectControllerRemoveComment(projectId, commentId));
}

// Approvals
export async function requestApproval(projectId: string, milestoneId: string, data?: RequestApprovalDto) {
  return wrap(() => api.projectControllerRequestMilestoneApproval(projectId, milestoneId, data ?? {}));
}

export async function respondApproval(projectId: string, approvalId: string, data: RespondApprovalDto) {
  return wrap(() => api.projectControllerRespondMilestoneApproval(projectId, approvalId, data));
}

export async function cancelApproval(projectId: string, approvalId: string) {
  return wrap(() => api.projectControllerCancelMilestoneApproval(projectId, approvalId));
}

export async function getApprovals(projectId: string, milestoneId: string) {
  return wrap(() => api.projectControllerGetMilestoneApprovals(projectId, milestoneId));
}

// Info Requests
export async function createInfoRequest(projectId: string, data: CreateInfoRequestDto) {
  return wrap(() => api.projectControllerAddInfoRequest(projectId, data));
}

export async function answerInfoRequest(projectId: string, requestId: string, data: AnswerInfoRequestDto) {
  return wrap(() => api.projectControllerAnswerInfoRequest(projectId, requestId, data));
}

export async function cancelInfoRequest(projectId: string, requestId: string) {
  return wrap(() => api.projectControllerCancelInfoRequestEndpoint(projectId, requestId));
}

export async function getInfoRequests(projectId: string): Promise<ApiResponse<PaginatedResponse<InfoRequest> | InfoRequest[]>> {
  return wrapAs<PaginatedResponse<InfoRequest> | InfoRequest[]>(() => api.projectControllerGetInfoRequests(projectId));
}

export async function getInfoRequestValue(projectId: string, requestId: string) {
  return wrap(() => api.projectControllerGetInfoRequestValue(projectId, requestId));
}
