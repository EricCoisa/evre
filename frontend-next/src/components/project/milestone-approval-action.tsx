'use client';

import { useState, useMemo } from 'react';
import {
  useApprovals,
  useRequestApproval,
  useRespondApproval,
  useCancelApproval,
} from '@/lib/actions/project/queries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  MessageSquareText,
  RefreshCw,
  Loader2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation, type TFunc } from '@/hooks/use-translation';

interface ApprovalItem {
  id: string;
  milestoneId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedById: string;
  respondedById?: string | null;
  requestNote?: string | null;
  responseNote?: string | null;
  requestedAt: string;
  respondedAt?: string | null;
  requestedBy?: { id: string; name: string };
  respondedBy?: { id: string; name: string } | null;
}

interface MilestoneApprovalActionProps {
  projectId: string;
  milestoneId: string;
  milestoneTitle: string;
  canEdit?: boolean;
}

function ApprovalStatusBadge({ status, t }: { status: ApprovalItem['status']; t: TFunc }) {
  if (status === 'APPROVED') {
    return (
      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
        <CheckCircle2 className="h-3 w-3" /> {t('approvalApproved')}
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
        <XCircle className="h-3 w-3" /> {t('approvalAdjustments')}
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
        <Clock className="h-3 w-3" /> {t('approvalPending')}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1 font-semibold">
      <XCircle className="h-3 w-3" /> {t('approvalCancelledStatus')}
    </span>
  );
}

// Histórico completo de rodadas de validação, exibido apenas quando há mais de uma
function ApprovalHistoryList({ approvals, t }: { approvals: ApprovalItem[]; t: TFunc }) {
  if (approvals.length <= 1) return null;
  return (
    <div className="space-y-2 pt-2 border-t">
      <p className="text-[11px] font-semibold text-muted-foreground">
        {t('approvalHistoryTitle', { count: approvals.length })}
      </p>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {approvals.map((appr, idx) => (
          <div
            key={appr.id}
            className={`text-[11px] p-2.5 rounded border space-y-1 ${
              idx === 0 ? 'bg-muted/40 font-medium' : 'bg-muted/10 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ApprovalStatusBadge status={appr.status} t={t} />
                {idx === 0 && (
                  <span className="text-[9px] text-primary font-semibold">
                    {t('approvalMostRecent')}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(appr.requestedAt).toLocaleDateString(undefined)}
              </span>
            </div>

            {appr.requestNote && (
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                <strong>{t('approvalHistoryTeam')}</strong> &ldquo;{appr.requestNote}&rdquo;
              </p>
            )}
            {appr.responseNote && (
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                <strong>{t('approvalHistoryClient')}</strong> &ldquo;{appr.responseNote}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Card com o status da resposta do cliente (pendente ou já respondida)
function ApprovalResponseCard({ approval, t }: { approval: ApprovalItem; t: TFunc }) {
  if (approval.status === 'PENDING') {
    return (
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            {t('approvalAwaitingClientTitle')}
          </span>
          {approval.requestedAt && (
            <span className="text-[11px] text-muted-foreground">
              {t('approvalSentOn', {
                date: new Date(approval.requestedAt).toLocaleDateString(undefined, {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('approvalAwaitingClient')}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-3.5 space-y-2 ${
        approval.status === 'REJECTED'
          ? 'border-rose-500/25 bg-rose-500/5'
          : 'border-emerald-500/25 bg-emerald-500/5'
      }`}
    >
      <div className="flex items-center justify-between text-xs">
        <span
          className={`font-semibold flex items-center gap-1 ${
            approval.status === 'REJECTED'
              ? 'text-rose-700 dark:text-rose-300'
              : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {approval.status === 'REJECTED' ? (
            <>
              <XCircle className="h-3.5 w-3.5" />
              {t('approvalClientAdjustments')}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('approvalClientApproved')}
            </>
          )}
        </span>

        {approval.respondedAt && (
          <span className="text-[11px] text-muted-foreground">
            {new Date(approval.respondedAt).toLocaleDateString(undefined, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      <div className="p-3 bg-background rounded-md border text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap min-h-12 shadow-xs">
        {approval.responseNote ? (
          approval.responseNote
        ) : (
          <span className="italic text-muted-foreground">{t('approvalNoWrittenNote')}</span>
        )}
      </div>

      {approval.respondedBy?.name && (
        <p className="text-[11px] text-muted-foreground text-right">
          {t('approvalRespondedBy', { name: approval.respondedBy.name })}
        </p>
      )}
    </div>
  );
}

// Card com a mensagem enviada pelo desenvolvedor nesta rodada de validação
function ApprovalDevMessageCard({ approval, t }: { approval: ApprovalItem; t: TFunc }) {
  if (!approval.requestNote) return null;
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-primary">
        <span className="flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {t('approvalDevMessage')}
        </span>
        {approval.requestedAt && (
          <span className="text-[11px] font-normal text-muted-foreground">
            {new Date(approval.requestedAt).toLocaleDateString(undefined, {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap p-2.5 bg-background/80 rounded border">
        {approval.requestNote}
      </p>
      {approval.requestedBy?.name && (
        <p className="text-[10px] text-muted-foreground text-right">
          {t('approvalSentBy', { name: approval.requestedBy.name })}
        </p>
      )}
    </div>
  );
}

interface ApprovalFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: ApprovalItem | null;
  sortedApprovals: ApprovalItem[];
  milestoneTitle: string;
  canEdit: boolean;
  onRequestCancel: () => void;
  onRequestResend: () => void;
  t: TFunc;
}

// Modal Compartilhado de Feedback do Cliente e Histórico
function ApprovalFeedbackDialog({
  open,
  onOpenChange,
  approval,
  sortedApprovals,
  milestoneTitle,
  canEdit,
  onRequestCancel,
  onRequestResend,
  t,
}: ApprovalFeedbackDialogProps) {
  if (!approval) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            {t('approvalStageFeedbackTitle', { title: milestoneTitle })}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {approval.status === 'REJECTED'
              ? t('approvalClientAdjustmentsDesc')
              : t('approvalValidationInfoDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <ApprovalDevMessageCard approval={approval} t={t} />

          {/* Card com o status da resposta do cliente */}
          <ApprovalResponseCard approval={approval} t={t} />

          {/* Histórico completo se houver mais de uma rodada de validação */}
          <ApprovalHistoryList approvals={sortedApprovals} t={t} />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
          >
            {t('approvalClose')}
          </Button>

          <div className="flex items-center gap-2">
            {canEdit && approval.status === 'PENDING' && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
                onClick={onRequestCancel}
              >
                <XCircle className="h-3.5 w-3.5" />
                {t('approvalCancelRequest')}
              </Button>
            )}

            {canEdit && approval.status === 'REJECTED' && (
              <Button size="sm" className="text-xs gap-1.5" onClick={onRequestResend}>
                <RefreshCw className="h-3.5 w-3.5" />
                {t('approvalResendForApproval')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ApprovalRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latestApproval: ApprovalItem | null;
  milestoneTitle: string;
  requestNote: string;
  onRequestNoteChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  t: TFunc;
}

// Modal para o desenvolvedor adicionar comentário ao enviar/reenviar para validação
function ApprovalRequestDialog({
  open,
  onOpenChange,
  latestApproval,
  milestoneTitle,
  requestNote,
  onRequestNoteChange,
  onSubmit,
  isSubmitting,
  t,
}: ApprovalRequestDialogProps) {
  const isResend = latestApproval?.status === 'REJECTED';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            {isResend ? t('approvalResendModalTitle') : t('approvalRequestModalTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('approvalRequestModalDesc', { title: milestoneTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isResend && latestApproval?.responseNote && (
            <div className="rounded-md border border-rose-500/25 bg-rose-500/5 p-2.5 space-y-1">
              <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {t('approvalLatestClientNote')}
              </span>
              <p className="text-xs text-foreground italic leading-relaxed whitespace-pre-wrap">
                &ldquo;{latestApproval.responseNote}&rdquo;
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>{t('approvalRequestNoteLabel')}</span>
              <span className="text-[10px] text-muted-foreground">{requestNote.length}/2000</span>
            </label>
            <Textarea
              placeholder={t('approvalRequestNotePlaceholder')}
              value={requestNote}
              onChange={(e) => onRequestNoteChange(e.target.value)}
              className="text-xs min-h-24 resize-none"
              maxLength={2000}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isResend ? t('approvalResendForValidation') : t('approvalSendForValidation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ApprovalCancelConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestoneTitle: string;
  isCancelling: boolean;
  onConfirm: () => void;
  t: TFunc;
}

function ApprovalCancelConfirmDialog({
  open,
  onOpenChange,
  milestoneTitle,
  isCancelling,
  onConfirm,
  t,
}: ApprovalCancelConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('approvalCancelModalTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('approvalCancelModalDesc', { title: milestoneTitle })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>{t('back')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isCancelling}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isCancelling ? '...' : t('approvalCancel')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ApprovalRespondDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latestApproval: ApprovalItem;
  milestoneTitle: string;
  responseNote: string;
  onResponseNoteChange: (value: string) => void;
  onRespond: (status: 'APPROVED' | 'REJECTED') => void;
  isSubmitting: boolean;
  t: TFunc;
}

// Modal do Cliente para Avaliar e Responder
function ApprovalRespondDialog({
  open,
  onOpenChange,
  latestApproval,
  milestoneTitle,
  responseNote,
  onResponseNoteChange,
  onRespond,
  isSubmitting,
  t,
}: ApprovalRespondDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{t('approvalReviewTitle')}</DialogTitle>
          <DialogDescription className="text-xs">
            {t('approvalReviewDesc', { title: milestoneTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {latestApproval.requestNote && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Send className="h-3.5 w-3.5" />
                {t('approvalDevMessage')}:
              </div>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {latestApproval.requestNote}
              </p>
              {latestApproval.requestedBy?.name && (
                <p className="text-[10px] text-muted-foreground text-right">
                  {t('approvalSentBy', { name: latestApproval.requestedBy.name })}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              {t('approvalResponseNoteLabel')}
            </label>
            <Textarea
              placeholder={t('approvalResponseNotePlaceholder')}
              value={responseNote}
              onChange={(e) => onResponseNoteChange(e.target.value)}
              className="text-xs min-h-20"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 border-destructive/30 text-xs"
            onClick={() => onRespond('REJECTED')}
            disabled={isSubmitting}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            {t('approvalRequestAdjustments')}
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            onClick={() => onRespond('APPROVED')}
            disabled={isSubmitting}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            {t('approvalApproveStage')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Trigger quando nenhuma aprovação foi solicitada ainda, ou a última foi cancelada
function NoApprovalTrigger({
  isCancelled,
  onOpenRequest,
  onOpenFeedback,
  t,
}: {
  isCancelled: boolean;
  onOpenRequest: () => void;
  onOpenFeedback: () => void;
  t: TFunc;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] text-muted-foreground hover:text-primary px-1.5"
        onClick={onOpenRequest}
        title={t('approvalRequestTooltip')}
      >
        <ShieldCheck className="mr-1 h-3 w-3" />
        {t('approvalRequestApproval')}
      </Button>

      {isCancelled && (
        <button
          type="button"
          onClick={onOpenFeedback}
          className="text-[10px] text-muted-foreground/80 hover:text-foreground underline cursor-pointer"
          title={t('approvalCancelledHistoryTooltip')}
        >
          {t('approvalCancelledHistory')}
        </button>
      )}
    </div>
  );
}

function ApprovedTrigger({
  approval,
  onOpenFeedback,
  t,
}: {
  approval: ApprovalItem;
  onOpenFeedback: () => void;
  t: TFunc;
}) {
  return (
    <button
      type="button"
      onClick={onOpenFeedback}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
      title={t('approvalApprovedTooltip')}
    >
      <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
      <span>{t('approvalStageApproved')}</span>
      {(approval.responseNote || approval.requestNote) && (
        <MessageSquareText className="h-3 w-3 ml-0.5 text-emerald-600" />
      )}
    </button>
  );
}

function RejectedTrigger({
  canEdit,
  onOpenFeedback,
  onOpenRequest,
  t,
}: {
  canEdit: boolean;
  onOpenFeedback: () => void;
  onOpenRequest: () => void;
  t: TFunc;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        type="button"
        onClick={onOpenFeedback}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer group"
        title={t('approvalFeedbackDetailTooltip')}
      >
        <XCircle className="h-3 w-3 text-rose-500 flex-shrink-0" />
        <span>{t('approvalAdjustmentsRequested')}</span>
        <MessageSquareText className="h-3 w-3 ml-0.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
      </button>

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[10px] text-muted-foreground hover:text-primary px-1.5 gap-1"
          onClick={onOpenRequest}
          title={t('approvalResendTooltip')}
        >
          <RefreshCw className="h-3 w-3" />
          {t('approvalResend')}
        </Button>
      )}
    </div>
  );
}

function PendingTrigger({
  approval,
  canEdit,
  onOpenFeedback,
  onOpenCancelConfirm,
  onOpenRespond,
  t,
}: {
  approval: ApprovalItem;
  canEdit: boolean;
  onOpenFeedback: () => void;
  onOpenCancelConfirm: () => void;
  onOpenRespond: () => void;
  t: TFunc;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge
        variant="outline"
        className="h-5 text-[10px] gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 animate-pulse cursor-pointer hover:bg-amber-500/20 transition-colors"
        title={t('approvalPendingTooltip')}
        onClick={onOpenFeedback}
      >
        <Clock className="h-3 w-3" />
        {t('approvalPendingValidation')}
        {approval.requestNote && (
          <MessageSquareText className="h-3 w-3 ml-0.5 text-amber-600" />
        )}
      </Badge>

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[10px] text-muted-foreground hover:text-destructive px-1.5 gap-1"
          onClick={onOpenCancelConfirm}
          title={t('approvalCancelTooltip')}
        >
          <XCircle className="h-3 w-3" />
          {t('approvalCancel')}
        </Button>
      )}

      {!canEdit && (
        <Button
          size="sm"
          variant="default"
          className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white font-medium"
          onClick={onOpenRespond}
        >
          {t('approvalEvaluateStage')}
        </Button>
      )}
    </div>
  );
}

export function MilestoneApprovalAction({
  projectId,
  milestoneId,
  milestoneTitle,
  canEdit = true,
}: MilestoneApprovalActionProps) {
  const { t } = useTranslation('project');
  const { data: approvalsData, isLoading } = useApprovals(projectId, milestoneId);
  const requestApprovalMutation = useRequestApproval(projectId);
  const respondApprovalMutation = useRespondApproval(projectId);
  const cancelApprovalMutation = useCancelApproval(projectId);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [isRespondOpen, setIsRespondOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [responseNote, setResponseNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReenviando, setIsReenviando] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Ordena rigorosamente do mais recente para o mais antigo
  const sortedApprovals = useMemo(() => {
    const raw = Array.isArray(approvalsData)
      ? (approvalsData as unknown as ApprovalItem[])
      : ((approvalsData as unknown as { data?: ApprovalItem[] })?.data ?? []);
    return [...raw].sort((a, b) => {
      const timeA = new Date(a.requestedAt).getTime();
      const timeB = new Date(b.requestedAt).getTime();
      return timeB - timeA;
    });
  }, [approvalsData]);

  // A aprovação mais recente é SEMPRE o primeiro item do array ordenado decrescente
  const latestApproval = sortedApprovals[0] ?? null;

  const handleRequestApproval = async () => {
    setIsReenviando(true);
    try {
      await requestApprovalMutation.mutateAsync({
        milestoneId,
        data: {
          requestNote: requestNote.trim() || undefined,
        },
      });
      toast.success(t('approvalSentSuccess'));
      setIsRequestModalOpen(false);
      setRequestNote('');
    } catch {
      toast.error(t('infoRequestCreateError'));
    } finally {
      setIsReenviando(false);
    }
  };

  const handleRespond = async (status: 'APPROVED' | 'REJECTED') => {
    if (!latestApproval) return;
    setIsSubmitting(true);
    try {
      await respondApprovalMutation.mutateAsync({
        approvalId: latestApproval.id,
        data: {
          status,
          responseNote: responseNote.trim() || undefined,
        },
      });
      toast.success(
        status === 'APPROVED'
          ? t('approvalApprovedSuccess')
          : t('approvalFeedbackSuccess')
      );
      setIsRespondOpen(false);
      setResponseNote('');
    } catch {
      toast.error(t('infoRequestAnswerError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelApproval = async () => {
    if (!latestApproval) return;
    setIsCancelling(true);
    try {
      await cancelApprovalMutation.mutateAsync(latestApproval.id);
      toast.success(t('approvalCancelledSuccess'));
      setIsCancelConfirmOpen(false);
      setIsFeedbackOpen(false);
    } catch {
      toast.error(t('approvalCancelError'));
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) return null;

  const cancelDialogEl = (
    <ApprovalCancelConfirmDialog
      open={isCancelConfirmOpen}
      onOpenChange={setIsCancelConfirmOpen}
      milestoneTitle={milestoneTitle}
      isCancelling={isCancelling}
      onConfirm={handleCancelApproval}
      t={t}
    />
  );

  const requestDialogEl = (
    <ApprovalRequestDialog
      open={isRequestModalOpen}
      onOpenChange={setIsRequestModalOpen}
      latestApproval={latestApproval}
      milestoneTitle={milestoneTitle}
      requestNote={requestNote}
      onRequestNoteChange={setRequestNote}
      onSubmit={handleRequestApproval}
      isSubmitting={isReenviando}
      t={t}
    />
  );

  const feedbackDialogEl = (
    <ApprovalFeedbackDialog
      open={isFeedbackOpen}
      onOpenChange={setIsFeedbackOpen}
      approval={latestApproval}
      sortedApprovals={sortedApprovals}
      milestoneTitle={milestoneTitle}
      canEdit={canEdit}
      onRequestCancel={() => {
        setIsFeedbackOpen(false);
        setIsCancelConfirmOpen(true);
      }}
      onRequestResend={() => {
        setIsFeedbackOpen(false);
        setIsRequestModalOpen(true);
      }}
      t={t}
    />
  );

  // 1. Nenhuma aprovação solicitada ainda ou a última foi cancelada
  if (!latestApproval || latestApproval.status === 'CANCELLED') {
    if (!canEdit) return null;
    return (
      <>
        <NoApprovalTrigger
          isCancelled={latestApproval?.status === 'CANCELLED'}
          onOpenRequest={() => setIsRequestModalOpen(true)}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          t={t}
        />
        {requestDialogEl}
        {feedbackDialogEl}
        {cancelDialogEl}
      </>
    );
  }

  // 3. Status = APPROVED
  if (latestApproval.status === 'APPROVED') {
    return (
      <>
        <ApprovedTrigger
          approval={latestApproval}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          t={t}
        />
        {feedbackDialogEl}
        {requestDialogEl}
        {cancelDialogEl}
      </>
    );
  }

  // 4. Status = REJECTED (Ajustes Solicitados)
  if (latestApproval.status === 'REJECTED') {
    return (
      <>
        <RejectedTrigger
          canEdit={canEdit}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          onOpenRequest={() => setIsRequestModalOpen(true)}
          t={t}
        />
        {feedbackDialogEl}
        {requestDialogEl}
        {cancelDialogEl}
      </>
    );
  }

  // 5. Status = PENDING (Validação Pendente)
  return (
    <>
      <PendingTrigger
        approval={latestApproval}
        canEdit={canEdit}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenCancelConfirm={() => setIsCancelConfirmOpen(true)}
        onOpenRespond={() => setIsRespondOpen(true)}
        t={t}
      />

      {feedbackDialogEl}
      {requestDialogEl}
      {cancelDialogEl}

      <ApprovalRespondDialog
        open={isRespondOpen}
        onOpenChange={setIsRespondOpen}
        latestApproval={latestApproval}
        milestoneTitle={milestoneTitle}
        responseNote={responseNote}
        onResponseNoteChange={setResponseNote}
        onRespond={handleRespond}
        isSubmitting={isSubmitting}
        t={t}
      />
    </>
  );
}
