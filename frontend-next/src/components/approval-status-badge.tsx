'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';
import type { ApprovalState } from '@/lib/actions/project/types';

interface ApprovalStatusBadgeProps {
  approvalState: ApprovalState | null | undefined;
  showComment?: boolean;
  className?: string;
}

export function ApprovalStatusBadge({
  approvalState,
  showComment = false,
  className,
}: ApprovalStatusBadgeProps) {
  const { t } = useTranslation('projects');

  if (!approvalState) {
    return null;
  }

  // Pendente de aprovação
  if (approvalState.hasPendingApproval) {
    return (
      <div className={cn('space-y-1', className)}>
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Clock className="h-3 w-3 mr-1" />
          {t('pendingApproval')}
        </Badge>
        {showComment && approvalState.lastApprovalComment && (
          <p className="text-xs text-muted-foreground">{approvalState.lastApprovalComment}</p>
        )}
      </div>
    );
  }

  // Tem status de aprovação
  if (approvalState.lastApprovalStatus) {
    const status = approvalState.lastApprovalStatus;
    
    let icon, bgColor, textLabel;
    switch (status) {
      case 'APPROVED':
        icon = <CheckCircle className="h-3 w-3 mr-1" />;
        bgColor = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        textLabel = t('approved');
        break;
      case 'APPROVED_WITH_REMARKS':
        icon = <AlertCircle className="h-3 w-3 mr-1" />;
        bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        textLabel = t('approveWithRemarks');
        break;
      case 'REJECTED':
        icon = <XCircle className="h-3 w-3 mr-1" />;
        bgColor = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        textLabel = t('rejected');
        break;
      default:
        icon = <Circle className="h-3 w-3 mr-1" />;
        bgColor = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
        textLabel = status;
    }

    return (
      <div className={cn('space-y-1', className)}>
        <Badge className={bgColor}>
          {icon}
          {textLabel}
        </Badge>
        {showComment && approvalState.lastApprovalComment && (
          <p className="text-xs text-muted-foreground italic">
            &quot;{approvalState.lastApprovalComment}&quot;
          </p>
        )}
      </div>
    );
  }

  // Sem aprovação
  return null;
}
