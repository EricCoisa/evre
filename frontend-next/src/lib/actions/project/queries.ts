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
  reorderStages,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  moveActivity,
  reorderActivities,
  getCommentsByEntity,
  createComment,
  deleteComment,
  getApprovalsByEntity,
  createApproval,
  getHistoryByProject,
  getStatusList,
} from './api';
import type { PaginationParams } from '@/lib/types/pagination.types';
import type {
  CreateProjectDto,
  UpdateProjectDto,
  CreateStageDto,
  UpdateStageDto,
  ReorderStagesDto,
  CreateActivityDto,
  UpdateActivityDto,
  MoveActivityDto,
  ReorderActivitiesDto,
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

export function useReorderStages() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: ReorderStagesDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useReorderStages');
      return Alive(() => reorderStages(data))();
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
    }
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

export function useMoveActivity() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: (data: MoveActivityDto) => {
      EmulateMutationError(emulateError, 'Emulated error from useMoveActivity');
      return Alive(() => moveActivity(data))();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['stages'] });
    },
  });
}

export function useReorderActivities() {
  const queryClient = useQueryClient();
  const { emulateError } = useApp();

  return useMutation({
    mutationFn: async (updates: Array<{ id: string; order: number }>) => {
      EmulateMutationError(emulateError, 'Emulated error from useReorderActivities');
      // Fazer chamadas individuais como Route faz
      await Promise.all(
        updates.map(({ id, order }) => Alive(() => updateActivity(id, { order }))())
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

// Comment Queries
export function useCommentsByEntity(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: Collector(() => getCommentsByEntity(entityType, entityId)),
    enabled: !!entityType && !!entityId,
    ...getQueryConfig('COMMENTS'),
  });
}

// Compatibilidade: comentários de um projeto
export function useCommentsByProject(projectId: string) {
  return useCommentsByEntity('PROJECT', projectId);
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
      // Invalida cache para a entidade específica
      queryClient.invalidateQueries({ queryKey: ['comments', variables.entityType, variables.entityId] });
      // Invalida também cache do projeto (para comentários em PROJECT)
      if (variables.entityType === 'PROJECT') {
        queryClient.invalidateQueries({ queryKey: ['comments', 'PROJECT', variables.projectId] });
      }
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
export function useApprovalsByEntity(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['approvals', entityType, entityId],
    queryFn: Collector(() => getApprovalsByEntity(entityType, entityId)),
    enabled: !!entityType && !!entityId,
    ...getQueryConfig('APPROVALS'),
  });
}

// Compatibilidade: aprovações de uma stage
export function useApprovalsByStage(stageId: string) {
  return useApprovalsByEntity('STAGE', stageId);
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
      // Invalida cache para a entidade específica
      queryClient.invalidateQueries({ queryKey: ['approvals', variables.entityType, variables.entityId] });
    },
  });
}

// ProjectHistory Queries
export function useHistoryByProject(projectId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: ['history', projectId, params],
    queryFn: Collector(() => getHistoryByProject(projectId, params)),
    enabled: !!projectId,
    ...getQueryConfig('HISTORY'),
  });
}

export function useStatus() {
  return useQuery({
    queryKey: ['project', 'status'],
    queryFn: Collector(() => getStatusList()),
    enabled: true,
    ...getQueryConfig('PROJECT', 'PROJECT'),
  });
}