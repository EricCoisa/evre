'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';
import { toast } from 'sonner';
import { useApprovals, useRespondApproval } from '@/lib/actions/project/queries';
import { DefaultNotificationRenderer } from './renderer-registry';
import type { NotificationRendererProps } from './renderer-registry';

type ApprovalItem = { id: string; status: string; requestNote?: string | null };

function usePendingApproval(projectId: string, milestoneId: string): ApprovalItem | undefined {
  const { data } = useApprovals(projectId, milestoneId);
  const list = Array.isArray(data)
    ? (data as ApprovalItem[])
    : ((data as { data?: ApprovalItem[] } | undefined)?.data ?? []);
  return list.find((a) => a.status === 'PENDING');
}

export function MilestoneApprovalRequestedRenderer({ notification, onMarkRead, onDismiss }: NotificationRendererProps) {
  const { t } = useTranslation('notification');
  const { t: tProject } = useTranslation('project');
  const [open, setOpen] = useState(false);
  const [responseNote, setResponseNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const payload = notification.payload as { projectId?: string; milestoneId?: string } | null;
  const projectId = payload?.projectId ?? '';
  const milestoneId = payload?.milestoneId ?? '';

  const pending = usePendingApproval(projectId, milestoneId);
  const respondMutation = useRespondApproval(projectId);

  async function handleRespond(status: 'APPROVED' | 'REJECTED') {
    if (!pending) return;
    setSubmitting(true);
    try {
      await respondMutation.mutateAsync({
        approvalId: pending.id,
        data: { status, responseNote: responseNote.trim() || undefined },
      });
      toast.success(
        status === 'APPROVED'
          ? tProject('approvalApprovedSuccess')
          : tProject('approvalFeedbackSuccess'),
      );
      setOpen(false);
      onMarkRead();
    } catch {
      toast.error(tProject('infoRequestAnswerError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DefaultNotificationRenderer
        notification={notification}
        onMarkRead={onMarkRead}
        onDismiss={onDismiss}
        extraAction={
          pending
            ? {
                label: t('action_evaluate'),
                onClick: () => setOpen(true),
              }
            : undefined
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{tProject('approvalReviewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pending?.requestNote && (
              <div className="rounded border border-primary/20 bg-primary/5 p-2.5 text-xs whitespace-pre-wrap">
                {pending.requestNote}
              </div>
            )}
            <Textarea
              placeholder={tProject('approvalResponseNotePlaceholder')}
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              className="text-xs min-h-20 resize-none"
            />
          </div>
          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => handleRespond('REJECTED')}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <XCircle className="size-3.5 mr-1" />
              )}
              {tProject('approvalRequestAdjustments')}
            </Button>
            <Button
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleRespond('APPROVED')}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="size-3.5 mr-1" />
              )}
              {tProject('approvalApproveStage')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
