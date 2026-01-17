'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateApproval } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { ApprovalStatus } from '@/lib/actions/project/types';
import Modal from '@/components/modal';

interface ApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approvalRequestId: string;
  projectName: string;
  stageName: string;
  onSuccess?: () => void;
}

export function ApprovalModal({
  open,
  onOpenChange,
  approvalRequestId,
  projectName,
  stageName,
  onSuccess,
}: ApprovalModalProps) {
  const { t } = useTranslation('projects');
  const [status, setStatus] = useState<ApprovalStatus>('APPROVED');
  const [comment, setComment] = useState('');
  const createApproval = useCreateApproval();

  const handleSubmit = async () => {
    // Validação: comentário obrigatório para REJECTED e APPROVED_WITH_REMARKS
    if (
      (status === 'REJECTED' || status === 'APPROVED_WITH_REMARKS') &&
      !comment.trim()
    ) {
      toast.error(t('commentRequired'));
      return;
    }

    try {
      await createApproval.mutateAsync({
        approvalRequestId,
        status,
        comment: comment.trim() || undefined,
      });

      toast.success(t('approvalSubmitted'));
      onOpenChange(false);
      onSuccess?.();

      // Limpar estado
      setStatus('APPROVED');
      setComment('');
    } catch (error) {
      toast.error(t('approvalError'));
    }
  };

  const isCommentRequired = status === 'REJECTED' || status === 'APPROVED_WITH_REMARKS';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('respondApprovalRequest')}
      description={t('approvalModalDescription')}
    >

      <div className="space-y-6 py-4">
        {/* Contexto */}
        <div className="space-y-2 border-l-4 border-blue-500 pl-4 bg-blue-50 dark:bg-blue-950 p-3 rounded-r">
          <div>
            <span className="text-sm font-semibold text-muted-foreground">{t('project')}:</span>
            <p className="text-base font-medium">{projectName}</p>
          </div>
          <div>
            <span className="text-sm font-semibold text-muted-foreground">{t('stage')}:</span>
            <p className="text-base font-medium">{stageName}</p>
          </div>
        </div>

        {/* Aviso importante */}
        <div className="bg-amber-50 dark:bg-amber-950 border-l-4 border-amber-500 p-4 rounded-r">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold mb-1">{t('importantDecision')}</p>
              <p>{t('rejectionWarning')}</p>
            </div>
          </div>
        </div>

        {/* Opções de decisão */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">{t('yourDecision')}</Label>
          <RadioGroup value={status} onValueChange={(value) => setStatus(value as ApprovalStatus)}>
            <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="APPROVED" id="approved" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="approved" className="cursor-pointer flex items-center gap-2 font-medium">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  {t('approveStage')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('approveDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="APPROVED_WITH_REMARKS" id="approved-remarks" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="approved-remarks" className="cursor-pointer flex items-center gap-2 font-medium">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  {t('approveWithRemarks')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('approveWithRemarksDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="REJECTED" id="rejected" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="rejected" className="cursor-pointer flex items-center gap-2 font-medium">
                  <XCircle className="h-5 w-5 text-red-600" />
                  {t('rejectStage')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('rejectDescription')}
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Campo de comentário */}
        <div className="space-y-2">
          <Label htmlFor="comment">
            {t('comment')} {isCommentRequired && <span className="text-red-500">*</span>}
          </Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              isCommentRequired
                ? t('commentRequiredPlaceholder')
                : t('commentOptionalPlaceholder')
            }
            rows={4}
            className={isCommentRequired && !comment.trim() ? 'border-red-500' : ''}
          />
          {isCommentRequired && !comment.trim() && (
            <p className="text-sm text-red-500">{t('commentRequiredMessage')}</p>
          )}
        </div>
      </div>




      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={createApproval.isPending}
        >
          {t('cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createApproval.isPending || (isCommentRequired && !comment.trim())}
          className={
            status === 'APPROVED'
              ? 'bg-green-600 hover:bg-green-700'
              : status === 'APPROVED_WITH_REMARKS'
                ? 'bg-yellow-600 hover:bg-yellow-700'
                : 'bg-red-600 hover:bg-red-700'
          }
        >
          {createApproval.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t('processing')}
            </>
          ) : (
            t('submitDecision')
          )}
        </Button>
      </div>
    </Modal>
  );
}
