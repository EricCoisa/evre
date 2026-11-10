"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProjects, getProject, createProject, updateProject, archiveProject,
  getProjectBoard,
  createMilestone, updateMilestone, deleteMilestone, reorderMilestones,
  createTask, updateTask, deleteTask, moveTask, reorderTasks,
  createComment, getComments, deleteComment,
  requestApproval, respondApproval, cancelApproval, getApprovals,
  createInfoRequest, answerInfoRequest, cancelInfoRequest, getInfoRequests, getInfoRequestValue,
} from "./api";
import type { PaginationParams } from "../../types/pagination.types";
import { getQueryConfig } from '../../utils';
import { Collector } from "@/lib/api/collector";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import type {
  CreateProjectDto, UpdateProjectDto,
  CreateMilestoneDto, UpdateMilestoneDto,
  CreateTaskDto, UpdateTaskDto,
  CreateCommentDto, RespondApprovalDto, RequestApprovalDto,
  CreateInfoRequestDto, AnswerInfoRequestDto,
  ProjectControllerGetCommentsParams,
} from "./types";

export function useProjects(params?: PaginationParams) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: Collector(() => getProjects(params)),
    ...getQueryConfig('PROJECTS'),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: Collector(() => getProject(id)),
    enabled: !!id,
    ...getQueryConfig('PROJECT'),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('project');

  return useMutation({
    mutationFn: (data: CreateProjectDto) => createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(t('createdSuccess'));
    }
  });
}

function useProjectSync() {
  const queryClient = useQueryClient();
  return (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  };
}

export function useUpdateProject() {
  const sync = useProjectSync();
  const { t } = useTranslation('project');

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectDto }) =>
      updateProject(id, data),
    onSuccess: (_, variables) => {
      sync(variables.id);
      toast.success(t('updatedSuccess'));
    }
  });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('project');

  return useMutation({
    mutationFn: archiveProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(t('archivedSuccess'));
    }
  });
}

// Board
export function useProjectBoard(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId, 'board'],
    queryFn: Collector(() => getProjectBoard(projectId)),
    enabled: !!projectId,
    ...getQueryConfig('PROJECT'),
  });
}

// Milestones
export function useCreateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMilestoneDto) => createMilestone(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useUpdateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, data }: { milestoneId: string; data: UpdateMilestoneDto }) =>
      updateMilestone(projectId, milestoneId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useDeleteMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) => deleteMilestone(projectId, milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useReorderMilestones(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderMilestones(projectId, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

// Tasks
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, data }: { milestoneId: string; data: CreateTaskDto }) =>
      createTask(projectId, milestoneId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskDto }) =>
      updateTask(projectId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(projectId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: { milestoneId: string; position: number } }) =>
      moveTask(projectId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useReorderTasks(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, orderedIds }: { milestoneId: string; orderedIds: string[] }) =>
      reorderTasks(projectId, milestoneId, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

// Comments
export function useComments(projectId: string, params: ProjectControllerGetCommentsParams) {
  return useQuery({
    queryKey: ['project', projectId, 'comments', params],
    queryFn: Collector(() => getComments(projectId, params)),
    enabled: !!projectId && !!params.entityType && !!params.entityId,
  });
}

export function useCreateComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommentDto) => createComment(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'comments'] });
    }
  });
}

export function useDeleteComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(projectId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'comments'] });
    }
  });
}

// Approvals
export function useApprovals(projectId: string, milestoneId: string) {
  return useQuery({
    queryKey: ['project', projectId, 'approvals', milestoneId],
    queryFn: Collector(() => getApprovals(projectId, milestoneId)),
    enabled: !!projectId && !!milestoneId,
  });
}

export function useRequestApproval(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: string | { milestoneId: string; data?: RequestApprovalDto }) => {
      const milestoneId = typeof args === 'string' ? args : args.milestoneId;
      const data = typeof args === 'string' ? undefined : args.data;
      return requestApproval(projectId, milestoneId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useRespondApproval(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, data }: { approvalId: string; data: RespondApprovalDto }) =>
      respondApproval(projectId, approvalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

export function useCancelApproval(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (approvalId: string) => cancelApproval(projectId, approvalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'board'] });
    }
  });
}

// Info Requests
export function useInfoRequests(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId, 'info-requests'],
    queryFn: Collector(() => getInfoRequests(projectId)),
    enabled: !!projectId,
  });
}

export function useCreateInfoRequest(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInfoRequestDto) => createInfoRequest(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'info-requests'] });
    }
  });
}

export function useAnswerInfoRequest(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: AnswerInfoRequestDto }) =>
      answerInfoRequest(projectId, requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'info-requests'] });
    }
  });
}

export function useCancelInfoRequest(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => cancelInfoRequest(projectId, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'info-requests'] });
    }
  });
}

export function useInfoRequestValue(projectId: string, requestId: string) {
  return useQuery({
    queryKey: ['project', projectId, 'info-requests', requestId, 'value'],
    queryFn: Collector(() => getInfoRequestValue(projectId, requestId)),
    enabled: !!projectId && !!requestId,
  });
}
