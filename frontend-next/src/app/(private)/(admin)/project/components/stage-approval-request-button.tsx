'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApprovalRequestsByStage, useCreateApprovalRequest } from '@/lib/actions/approval-request/queries';
import { useStageApprovalState } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { MessageSquare, Loader2, RefreshCw } from 'lucide-react';

interface StageApprovalRequestButtonProps {
  stageId: string;
  projectId: string;
}

export function StageApprovalRequestButton({
  stageId,
  projectId,
}: StageApprovalRequestButtonProps) {
  const { t } = useTranslation('projects');

  // Busca approval requests para este stage específico
  const { data: approvalRequestsData } = useApprovalRequestsByStage(stageId);

  // Busca estado de aprovação com informação sobre se pode solicitar nova aprovação
  const { data: approvalState } = useStageApprovalState(stageId);

  const createApprovalRequest = useCreateApprovalRequest();

  const approvalRequests = approvalRequestsData || [];

  // Usa canRequestNewApproval do backend para determinar se botão está habilitado
  const canRequest = approvalState?.canRequestNewApproval ?? false;
  const isDisabled = !canRequest || createApprovalRequest.isPending;

  // Determina se é uma reaprovação baseado no último status
  const isReapproval = approvalState?.lastApprovalStatus === 'REJECTED' || 
                       approvalState?.lastApprovalStatus === 'APPROVED_WITH_REMARKS';

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
      variant={isReapproval ? "default" : "outline"}
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
          {isReapproval ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('requestNewApproval')}
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('sendToApproval')}
            </>
          )}
        </>
      )}
    </Button>
  );
}