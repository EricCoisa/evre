import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApprovalRequests, getApprovalRequest, createApprovalRequest, updateApprovalRequest, deleteApprovalRequest } from "./api";
import type { CreateApprovalRequestDto, UpdateApprovalRequestDto } from "./types";
import { PaginationParams } from "../../types/pagination.types";
import { getQueryConfig } from '../../utils';
import { Collector } from "@/lib/api/collector";
import { toast } from "sonner";

export function useApprovalRequests(params?: PaginationParams) {
  return useQuery({
    queryKey: ['approvalRequests', params],
    queryFn: Collector(() => getApprovalRequests(params)),
    ...getQueryConfig('APPROVAL_REQUESTS'),
  });
}

export function useApprovalRequest(id: string) {
  return useQuery({
    queryKey: ['approvalRequest', id],
    queryFn: Collector(() => getApprovalRequest(id)),
    enabled: !!id,
    ...getQueryConfig('APPROVAL_REQUEST'),
  });
}


export function useCreateApprovalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApprovalRequestDto) => createApprovalRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
      toast.success('Solicitação de aprovação criada com sucesso');
    }
  });
}


export function useUpdateApprovalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApprovalRequestDto }) =>
      updateApprovalRequest(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
      queryClient.invalidateQueries({ queryKey: ['approvalRequest', variables.id] });
      toast.success('Solicitação de aprovação atualizada com sucesso');
    }
  });
}

export function useDeleteApprovalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteApprovalRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
      toast.success('Solicitação de aprovação deletada com sucesso');
    }
  });
}
