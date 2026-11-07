'use client';

import { useState } from 'react';
import {
  useInfoRequests,
  useCreateInfoRequest,
  useAnswerInfoRequest,
  useCancelInfoRequest,
  useInfoRequestValue,
} from '@/lib/actions/project/queries';
import { Card, CardContent } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { RichTextInput } from '@/components/rich-text-input';
import { RichTextViewer } from './rich-text-viewer';
import {
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  KeyRound,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';
import type { InfoRequest } from '@/lib/actions/project/types';

interface ProjectInfoRequestsViewProps {
  projectId: string;
  mode?: 'admin' | 'client';
}

export function ProjectInfoRequestsView({
  projectId,
  mode = 'admin',
}: ProjectInfoRequestsViewProps) {
  const { t } = useTranslation('project');
  const { data: requestsData, isLoading } = useInfoRequests(projectId);
  const createMutation = useCreateInfoRequest(projectId);
  const answerMutation = useAnswerInfoRequest(projectId);
  const cancelMutation = useCancelInfoRequest(projectId);

  // Estados de modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Estado para cancelar solicitação (admin)
  const [cancellingRequest, setCancellingRequest] = useState<InfoRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Estado para responder solicitação (cliente)
  const [answeringRequest, setAnsweringRequest] = useState<InfoRequest | null>(null);
  const [answerValue, setAnswerValue] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);

  // Estado para ver valor descriptografado (admin)
  const [viewingRequestId, setViewingRequestId] = useState<string | null>(null);
  const { data: secretValueData, isLoading: isLoadingSecret } = useInfoRequestValue(
    projectId,
    viewingRequestId ?? ''
  );

  const requests: InfoRequest[] = Array.isArray(requestsData)
    ? requestsData
    : requestsData?.data ?? [];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'ANSWERED':
        return { label: t('infoRequestStatusAnswered'), icon: CheckCircle2, variant: 'default' as const };
      case 'EXPIRED':
        return { label: t('infoRequestStatusExpired'), icon: XCircle, variant: 'destructive' as const };
      case 'CANCELLED':
        return { label: t('infoRequestStatusCancelled'), icon: XCircle, variant: 'secondary' as const };
      case 'PENDING':
      default:
        return { label: t('infoRequestStatusPending'), icon: Clock, variant: 'outline' as const };
    }
  };

  const handleCreate = async () => {
    const trimmedLabel = newLabel.trim();
    if (!trimmedLabel) return;

    setIsCreating(true);
    try {
      await createMutation.mutateAsync({
        label: trimmedLabel,
        description: newDesc.trim() || undefined,
      });
      setNewLabel('');
      setNewDesc('');
      setIsCreateOpen(false);
      toast.success(t('infoRequestCreatedSuccess'));
    } catch {
      toast.error(t('infoRequestCreateError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancellingRequest) return;
    setIsCancelling(true);
    try {
      await cancelMutation.mutateAsync(cancellingRequest.id);
      toast.success(t('infoRequestCancelSuccess'));
      setCancellingRequest(null);
    } catch {
      toast.error(t('infoRequestCancelError'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAnswer = async () => {
    if (!answeringRequest) return;
    const trimmed = answerValue.trim();
    if (!trimmed) return;

    setIsAnswering(true);
    try {
      await answerMutation.mutateAsync({
        requestId: answeringRequest.id,
        data: { value: trimmed },
      });
      setAnswerValue('');
      setAnsweringRequest(null);
      toast.success(t('infoRequestAnsweredSuccess'));
    } catch {
      toast.error(t('infoRequestAnswerError'));
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho explicativo amigável */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            {mode === 'client' ? t('infoRequestsClientTitle') : t('infoRequestsTitle')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === 'client'
              ? t('infoRequestsClientDescription')
              : t('infoRequestsDescription')}
          </p>
        </div>

        {mode === 'admin' && (
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('newInfoRequest')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          {t('loadingInfoRequests')}
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-2">
            <div className="rounded-full bg-muted w-10 h-10 flex items-center justify-center mx-auto text-muted-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('noInfoRequestsTitle')}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {mode === 'client'
                ? t('noInfoRequestsClientDesc')
                : t('noInfoRequestsAdminDesc')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {requests.map((req) => {
            const config = getStatusConfig(req.status);
            const Icon = config.icon;
            const isPending = req.status === 'PENDING';
            const isAnswered = req.status === 'ANSWERED';

            return (
              <Card
                key={req.id}
                className={`transition-colors border ${
                  isPending ? 'border-amber-500/40 bg-amber-50/10' : 'bg-card'
                }`}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-muted/60 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">
                        {req.label}
                      </span>
                    </div>

                    {req.description && (
                      <div className="text-xs text-muted-foreground">
                        <RichTextViewer content={req.description} />
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>{t('infoRequestRequestedBy', { name: req.requestedBy?.name ?? t('infoRequestTeam') })}</span>
                      <span>•</span>
                      <span>{formatDate(req.createdAt)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    <Badge variant={config.variant} className="text-xs">
                      {config.label}
                    </Badge>

                    {mode === 'client' && isPending && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
                        onClick={() => {
                          setAnsweringRequest(req);
                          setAnswerValue('');
                        }}
                      >
                        {t('answerNow')}
                      </Button>
                    )}

                    {mode === 'admin' && isPending && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1"
                        onClick={() => setCancellingRequest(req)}
                        title={t('cancelInfoRequestTooltip')}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t('cancel')}
                      </Button>
                    )}

                    {mode === 'admin' && isAnswered && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setViewingRequestId(req.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('viewResponse')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Criar Solicitação (Admin) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {t('createInfoRequestModalTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('createInfoRequestModalDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                {t('infoRequestNeedLabel')} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t('infoRequestNeedPlaceholder')}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                {t('infoRequestInstructionsLabel')}
              </label>
              <RichTextInput
                ariaLabel={t('infoRequestInstructionsLabel')}
                placeholder={t('infoRequestInstructionsPlaceholder')}
                value={newDesc}
                onChange={setNewDesc}
                className="min-h-24 text-xs"
                formatLabels={{
                  bold: t('richTextBold'),
                  italic: t('richTextItalic'),
                  strikethrough: t('richTextStrikethrough'),
                  code: t('richTextCode'),
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              className="text-xs"
            >
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newLabel.trim() || isCreating}
              className="text-xs"
            >
              {t('sendInfoRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Responder Solicitação (Cliente) */}
      <Dialog
        open={!!answeringRequest}
        onOpenChange={(open) => !open && setAnsweringRequest(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Lock className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                {t('encryptedSubmissionBadge')}
              </span>
            </div>
            <DialogTitle className="text-base font-semibold">
              {answeringRequest?.label}
            </DialogTitle>
            {answeringRequest?.description && (
              <div className="text-xs text-muted-foreground pt-1">
                <RichTextViewer content={answeringRequest.description} />
              </div>
            )}
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-foreground">
              {t('confidentialResponseLabel')}
            </label>
            <RichTextInput
              ariaLabel={t('confidentialResponseLabel')}
              placeholder={t('confidentialResponsePlaceholder')}
              value={answerValue}
              onChange={setAnswerValue}
              className="min-h-28 text-xs font-mono"
              formatLabels={{
                bold: t('richTextBold'),
                italic: t('richTextItalic'),
                strikethrough: t('richTextStrikethrough'),
                code: t('richTextCode'),
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              {t('encryptionNotice')}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnsweringRequest(null)}
              className="text-xs"
            >
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleAnswer}
              disabled={!answerValue.trim() || isAnswering}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {t('sendSecurely')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Resposta Descriptografada (Admin) */}
      <Dialog
        open={!!viewingRequestId}
        onOpenChange={(open) => !open && setViewingRequestId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                {t('decryptedDataBadge')}
              </span>
            </div>
            <DialogTitle className="text-base font-semibold">
              {t('clientResponseTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('decryptedDataDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            {isLoadingSecret ? (
              <p className="text-xs text-muted-foreground">{t('decrypting')}</p>
            ) : (
              <div className="rounded-lg border bg-muted/40 p-3 font-mono text-xs select-all break-all whitespace-pre-wrap">
                {typeof secretValueData === 'string'
                  ? secretValueData
                  : (secretValueData as unknown as { data?: string })?.data ??
                    JSON.stringify(secretValueData, null, 2)}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setViewingRequestId(null)}
              className="text-xs"
            >
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação para Cancelar Solicitação */}
      <AlertDialog
        open={!!cancellingRequest}
        onOpenChange={(open) => !open && setCancellingRequest(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelInfoRequestConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancelInfoRequestConfirmDesc', { label: cancellingRequest?.label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>{t('back')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelRequest}
              disabled={isCancelling}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isCancelling ? '...' : t('cancelInfoRequestConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
