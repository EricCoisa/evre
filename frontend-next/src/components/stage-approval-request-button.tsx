'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApprovalRequests, useCreateApprovalRequest } from '@/lib/actions/approval-request/queries';
import { useTranslation } from '@/hooks/use-translation';
import { MessageSquare, Loader2 } from 'lucide-react';

interface StageApprovalRequestButtonProps {
  stageId: string;
  projectId: string;
}

export function StageApprovalRequestButton({
  stageId,
  projectId,
}: StageApprovalRequestButtonProps) {
  const { t } = useTranslation('projects');

  // Busca approval requests para este stage
  const { data: approvalRequestsData } = useApprovalRequests({
    filter: { stageId },
    pagination: false
  });

  const createApprovalRequest = useCreateApprovalRequest();

  const approvalRequests = Array.isArray(approvalRequestsData)
    ? approvalRequestsData
    : approvalRequestsData?.data || [];

  // Verifica se já existe uma solicitação (qualquer status)
  const hasApprovalRequest = approvalRequests.length > 0;

  const isDisabled = hasApprovalRequest || createApprovalRequest.isPending;

  const handleRequestApproval = async () => {
    try {
      await createApprovalRequest.mutateAsync({
        projectId,
        stageId
      });
    } catch (error) {
      console.error('Erro ao solicitar aprovação:', error);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRequestApproval}
      disabled={isDisabled}
      className="ml-2"
    >
      {createApprovalRequest.isPending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {t('sending')}
        </>
      ) : (
        <>
          <MessageSquare className="h-4 w-4 mr-2" />
          {t('sendToApproval')}
        </>
      )}
    </Button>
  );
}