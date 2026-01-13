'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApprovalsByEntity, useCreateApproval } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

interface StageApprovalButtonProps {
  stageId: string;
  stageName: string;
  projectId: string;
}

export function StageApprovalButton({
  stageId,
  stageName,
  projectId,
}: StageApprovalButtonProps) {
  const { t, locale: currentLocale } = useTranslation('projects');
  const [showConfirm, setShowConfirm] = useState(false);
  const [action, setAction] = useState<'approve' | 'revert'>('approve');

  const { data: approvals, isLoading } = useApprovalsByEntity('STAGE', stageId);
  const createApprovalMutation = useCreateApproval();

  const isApproved = approvals && approvals.length > 0 && approvals[0].status === 'APPROVED';
  const lastApproval = approvals && approvals.length > 0 ? approvals[0] : null;

  const handleConfirm = async () => {
    try {
      await createApprovalMutation.mutateAsync({
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        entityType: 'STAGE',
        entityId: stageId,
        projectId,
      });

      toast.success(
        action === 'approve' ? t('stageApproved') : t('stageApprovalReverted')
      );
      setShowConfirm(false);
    } catch {
      toast.error(t('approvalError'));
    }
  };

  const handleClick = (actionType: 'approve' | 'revert') => {
    setAction(actionType);
    setShowConfirm(true);
  };

  const locale = currentLocale === 'pt-BR' ? ptBR : enUS;

  if (isLoading) {
    return (
      <Button size="sm" variant="ghost" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {isApproved ? (
          <>
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span>{t('approved')}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleClick('revert')}
              className="h-8 px-2"
            >
              <XCircle className="h-4 w-4 text-orange-600" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{t('pending')}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleClick('approve')}
              className="h-8 px-2"
            >
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
          </>
        )}
      </div>

      {lastApproval && (
        <div className="text-xs text-muted-foreground">
          {t('by')} {t('unknownUser')} •{' '}
          {formatDistanceToNow(new Date(lastApproval.createdAt), {
            addSuffix: true,
            locale,
          })}
        </div>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'approve' ? t('confirmApproval') : t('confirmRevert')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === 'approve'
                ? t('confirmApprovalDescription', { stageName })
                : t('confirmRevertDescription', { stageName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createApprovalMutation.isPending}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={createApprovalMutation.isPending}
              className={
                action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }
            >
              {createApprovalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('processing')}
                </>
              ) : action === 'approve' ? (
                t('approve')
              ) : (
                t('revert')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
