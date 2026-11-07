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
import { useTranslation } from '@/hooks/use-translation';

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

  const cancelConfirmationDialog = (
    <AlertDialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
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
            onClick={handleCancelApproval}
            disabled={isCancelling}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isCancelling ? '...' : t('approvalCancel')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isLoading) return null;

  // Modal para o desenvolvedor adicionar comentário ao enviar/reenviar para validação
  const requestApprovalDialog = (
    <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            {latestApproval?.status === 'REJECTED'
              ? t('approvalResendModalTitle')
              : t('approvalRequestModalTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('approvalRequestModalDesc', { title: milestoneTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {latestApproval?.status === 'REJECTED' && latestApproval.responseNote && (
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
              onChange={(e) => setRequestNote(e.target.value)}
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
            onClick={() => setIsRequestModalOpen(false)}
            disabled={isReenviando}
          >
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleRequestApproval}
            disabled={isReenviando}
          >
            {isReenviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {latestApproval?.status === 'REJECTED'
              ? t('approvalResendForValidation')
              : t('approvalSendForValidation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Modal Compartilhado de Feedback do Cliente e Histórico
  const feedbackDialog = latestApproval ? (
    <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            {t('approvalStageFeedbackTitle', { title: milestoneTitle })}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {latestApproval.status === 'REJECTED'
              ? t('approvalClientAdjustmentsDesc')
              : t('approvalValidationInfoDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card com a mensagem enviada pelo desenvolvedor nesta rodada */}
          {latestApproval.requestNote && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  {t('approvalDevMessage')}
                </span>
                {latestApproval.requestedAt && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {new Date(latestApproval.requestedAt).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap p-2.5 bg-background/80 rounded border">
                {latestApproval.requestNote}
              </p>
              {latestApproval.requestedBy?.name && (
                <p className="text-[10px] text-muted-foreground text-right">
                  {t('approvalSentBy', { name: latestApproval.requestedBy.name })}
                </p>
              )}
            </div>
          )}

          {/* Card com o status da resposta do cliente */}
          {latestApproval.status === 'PENDING' ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  {t('approvalAwaitingClientTitle')}
                </span>
                {latestApproval.requestedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    {t('approvalSentOn', {
                      date: new Date(latestApproval.requestedAt).toLocaleDateString(undefined, {
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
          ) : (
            <div
              className={`rounded-lg border p-3.5 space-y-2 ${
                latestApproval.status === 'REJECTED'
                  ? 'border-rose-500/25 bg-rose-500/5'
                  : 'border-emerald-500/25 bg-emerald-500/5'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    latestApproval.status === 'REJECTED'
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {latestApproval.status === 'REJECTED' ? (
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

                {latestApproval.respondedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(latestApproval.respondedAt).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>

              {/* Mensagem digitada */}
              <div className="p-3 bg-background rounded-md border text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap min-h-12 shadow-xs">
                {latestApproval.responseNote ? (
                  latestApproval.responseNote
                ) : (
                  <span className="italic text-muted-foreground">
                    {t('approvalNoWrittenNote')}
                  </span>
                )}
              </div>

              {latestApproval.respondedBy?.name && (
                <p className="text-[11px] text-muted-foreground text-right">
                  {t('approvalRespondedBy', { name: latestApproval.respondedBy.name })}
                </p>
              )}
            </div>
          )}

          {/* Histórico completo se houver mais de uma rodada de validação */}
          {sortedApprovals.length > 1 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {t('approvalHistoryTitle', { count: sortedApprovals.length })}
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {sortedApprovals.map((appr, idx) => (
                  <div
                    key={appr.id}
                    className={`text-[11px] p-2.5 rounded border space-y-1 ${
                      idx === 0 ? 'bg-muted/40 font-medium' : 'bg-muted/10 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {appr.status === 'APPROVED' && (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> {t('approvalApproved')}
                          </span>
                        )}
                        {appr.status === 'REJECTED' && (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                            <XCircle className="h-3 w-3" /> {t('approvalAdjustments')}
                          </span>
                        )}
                        {appr.status === 'PENDING' && (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                            <Clock className="h-3 w-3" /> {t('approvalPending')}
                          </span>
                        )}
                        {appr.status === 'CANCELLED' && (
                          <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                            <XCircle className="h-3 w-3" /> {t('approvalCancelledStatus')}
                          </span>
                        )}
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
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setIsFeedbackOpen(false)}
          >
            {t('approvalClose')}
          </Button>

          <div className="flex items-center gap-2">
            {canEdit && latestApproval.status === 'PENDING' && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
                onClick={() => {
                  setIsFeedbackOpen(false);
                  setIsCancelConfirmOpen(true);
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                {t('approvalCancelRequest')}
              </Button>
            )}

            {canEdit && latestApproval.status === 'REJECTED' && (
              <Button
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  setIsFeedbackOpen(false);
                  setIsRequestModalOpen(true);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('approvalResendForApproval')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  // 1. Nenhuma aprovação solicitada ainda ou a última foi cancelada
  if (!latestApproval || latestApproval.status === 'CANCELLED') {
    if (!canEdit) return null;
    return (
      <>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground hover:text-primary px-1.5"
            onClick={() => setIsRequestModalOpen(true)}
            title={t('approvalRequestTooltip')}
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            {t('approvalRequestApproval')}
          </Button>

          {latestApproval?.status === 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="text-[10px] text-muted-foreground/80 hover:text-foreground underline cursor-pointer"
              title={t('approvalCancelledHistoryTooltip')}
            >
              {t('approvalCancelledHistory')}
            </button>
          )}
        </div>
        {requestApprovalDialog}
        {feedbackDialog}
        {cancelConfirmationDialog}
      </>
    );
  }

  // 3. Status = APPROVED
  if (latestApproval.status === 'APPROVED') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsFeedbackOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          title={t('approvalApprovedTooltip')}
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
          <span>{t('approvalStageApproved')}</span>
          {(latestApproval.responseNote || latestApproval.requestNote) && (
            <MessageSquareText className="h-3 w-3 ml-0.5 text-emerald-600" />
          )}
        </button>
        {feedbackDialog}
        {requestApprovalDialog}
        {cancelConfirmationDialog}
      </>
    );
  }

  // 4. Status = REJECTED (Ajustes Solicitados)
  if (latestApproval.status === 'REJECTED') {
    return (
      <>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
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
              onClick={() => setIsRequestModalOpen(true)}
              title={t('approvalResendTooltip')}
            >
              <RefreshCw className="h-3 w-3" />
              {t('approvalResend')}
            </Button>
          )}
        </div>
        {feedbackDialog}
        {requestApprovalDialog}
        {cancelConfirmationDialog}
      </>
    );
  }

  // 5. Status = PENDING (Validação Pendente)
  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant="outline"
          className="h-5 text-[10px] gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 animate-pulse cursor-pointer hover:bg-amber-500/20 transition-colors"
          title={t('approvalPendingTooltip')}
          onClick={() => setIsFeedbackOpen(true)}
        >
          <Clock className="h-3 w-3" />
          {t('approvalPendingValidation')}
          {latestApproval.requestNote && (
            <MessageSquareText className="h-3 w-3 ml-0.5 text-amber-600" />
          )}
        </Badge>

        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] text-muted-foreground hover:text-destructive px-1.5 gap-1"
            onClick={() => setIsCancelConfirmOpen(true)}
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
            onClick={() => setIsRespondOpen(true)}
          >
            {t('approvalEvaluateStage')}
          </Button>
        )}
      </div>

      {feedbackDialog}
      {requestApprovalDialog}
      {cancelConfirmationDialog}

      {/* Modal do Cliente para Avaliar e Responder */}
      <Dialog open={isRespondOpen} onOpenChange={setIsRespondOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {t('approvalReviewTitle')}
            </DialogTitle>
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
                onChange={(e) => setResponseNote(e.target.value)}
                className="text-xs min-h-20"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 border-destructive/30 text-xs"
              onClick={() => handleRespond('REJECTED')}
              disabled={isSubmitting}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" />
              {t('approvalRequestAdjustments')}
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              onClick={() => handleRespond('APPROVED')}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              {t('approvalApproveStage')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
