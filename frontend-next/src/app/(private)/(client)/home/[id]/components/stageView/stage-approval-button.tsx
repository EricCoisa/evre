'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApprovalByRequest } from '@/lib/actions/project/queries';
import { useApprovalRequestsByStage } from '@/lib/actions/approval-request/queries';
import { useTranslation } from '@/hooks/use-translation';
import { CheckCircle, AlertCircle, XCircle, Loader2, MessageSquare } from 'lucide-react';
import { ApprovalModal } from '@/app/(private)/(client)/home/[id]/components/approval-modal';
import { ApprovalStatusColors } from '@/lib/actions/project/types';
import { Badge } from '@/components/ui/badge';

interface StageApprovalButtonProps {
  stageId: string;
  stageName: string;
  projectId: string;
  projectName: string;
}

export function StageApprovalButton({
  stageId,
  stageName,
  projectId,
  projectName,
}: StageApprovalButtonProps) {
  const { t } = useTranslation('projects');
  const [showModal, setShowModal] = useState(false);

  // Busca approval requests para este stage específico
  const { data: approvalRequestsData, isLoading: loadingRequests } = useApprovalRequestsByStage(stageId);

  const approvalRequests = approvalRequestsData || [];

  // Encontra o request pendente (se houver)
  const pendingRequest = approvalRequests.find(req => req.status === 'PENDING');
  
  // Se existe request, busca a aprovação (se já foi respondida)
  const { data: approval, isLoading: loadingApproval } = useApprovalByRequest(
    pendingRequest?.id || '',
  );

  console.log('StageApprovalButton', { stageId, pendingRequest, approval });

  if (loadingRequests || loadingApproval) {
    return (
      <Button size="sm" variant="ghost" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  // Se não há request pendente, não mostra nada
  if (!pendingRequest) {
    return null;
  }

  // Se já foi respondido, mostra o status da aprovação
  if (approval) {
    const statusIcon = {
      APPROVED: <CheckCircle className="h-4 w-4" />,
      APPROVED_WITH_REMARKS: <AlertCircle className="h-4 w-4" />,
      REJECTED: <XCircle className="h-4 w-4" />,
    }[approval.status];

    const statusText = {
      APPROVED: t('approved'),
      APPROVED_WITH_REMARKS: t('approveWithRemarks'),
      REJECTED: t('rejected'),
    }[approval.status];

    return (
      <div className="space-y-2">
        <Badge className={ApprovalStatusColors[approval.status]}>
          <div className="flex items-center gap-1">
            {statusIcon}
            <span>{statusText}</span>
          </div>
        </Badge>
        {approval.comment && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
            <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>{approval.comment}</p>
          </div>
        )}
      </div>
    );
  }

  // Se há request pendente e não foi respondido, mostra botão para responder
  return (
    <>
      <Button
        size="sm"
        onClick={() => setShowModal(true)}
        className="bg-blue-600 hover:bg-blue-700"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        {t('respondApprovalRequest')}
      </Button>

      <ApprovalModal
        open={showModal}
        onOpenChange={setShowModal}
        approvalRequestId={pendingRequest.id}
        projectName={projectName}
        stageName={stageName}
        onSuccess={() => {
          // Modal fecha e dados são revalidados automaticamente
        }}
      />
    </>
  );
}
