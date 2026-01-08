import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getStages,
  createStage,
  updateStage,
  deleteStage,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  getCommentsByProject,
  createComment,
  deleteComment,
  getApprovalsByStage,
  createApproval,
  getHistoryByProject,
} from './api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import type {
  CreateProjectDto,
  UpdateProjectDto,
  CreateStageDto,
  UpdateStageDto,
  CreateActivityDto,
  UpdateActivityDto,
  CreateCommentDto,
  CreateApprovalDto,
} from './types';
import { Collector, Alive, EmulateMutationError } from '@/lib/api/collector';
import { getQueryConfig } from '@/lib/utils';
import { useApp } from '@/contexts/appProvider';

// Project Queries
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
    ...getQueryConfig('PROJECT', 'PROJECT'),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: CreateProjectDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useCreateProject');
      return Alive(() => createProject(data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectDto }) => {
      EmulateMutationError(emulateError, 'Emulated error from useUpdateProject');
      return Alive(() => updateProject(id, data))();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useDeleteProject');
      return Alive(() => deleteProject(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Stage Queries
export function useStages(params?: PaginationParams) {
  return useQuery({
    queryKey: ['stages', params],
    queryFn: Collector(() => getStages(params)),
    ...getQueryConfig('STAGES'),
  });
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: CreateStageDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useCreateStage');
      return Alive(() => createStage(data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStageDto }) => {
      EmulateMutationError(emulateError, 'Emulated error from useUpdateStage');
      return Alive(() => updateStage(id, data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] });
    },
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useDeleteStage');
      return Alive(() => deleteStage(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] });
    },
  });
}

// Activity Queries
export function useActivities(params?: PaginationParams) {
  return useQuery({
    queryKey: ['activities', params],
    queryFn: Collector(() => getActivities(params)),
    ...getQueryConfig('ACTIVITIES'),
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: CreateActivityDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useCreateActivity');
      return Alive(() => createActivity(data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActivityDto }) => {
      EmulateMutationError(emulateError, 'Emulated error from useUpdateActivity');
      return Alive(() => updateActivity(id, data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useDeleteActivity');
      return Alive(() => deleteActivity(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

// Comment Queries
export function useCommentsByProject(projectId: string) {
  return useQuery({
    queryKey: ['comments', projectId],
    queryFn: Collector(() => getCommentsByProject(projectId)),
    enabled: !!projectId,
    ...getQueryConfig('COMMENTS'),
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: CreateCommentDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useCreateComment');
      return Alive(() => createComment(data))();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.projectId] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (id: string) => {
      EmulateMutationError(emulateError, 'Emulated error from useDeleteComment');
      return Alive(() => deleteComment(id))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// Approval Queries
export function useApprovalsByStage(stageId: string) {
  return useQuery({
    queryKey: ['approvals', stageId],
    queryFn: Collector(() => getApprovalsByStage(stageId)),
    enabled: !!stageId,
    ...getQueryConfig('APPROVALS'),
  });
}

export function useCreateApproval() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: CreateApprovalDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useCreateApproval');
      return Alive(() => createApproval(data))();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approvals', variables.stageId] });
    },
  });
}

// ProjectHistory Queries
export function useHistoryByProject(projectId: string) {
  return useQuery({
    queryKey: ['history', projectId],
    queryFn: Collector(() => getHistoryByProject(projectId)),
    enabled: !!projectId,
    ...getQueryConfig('HISTORY'),
  });
}
