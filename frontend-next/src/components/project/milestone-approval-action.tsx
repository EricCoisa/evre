'use client';

import { useState, useMemo } from 'react';
import {
  useApprovals,
  useRequestApproval,
  useRespondApproval,
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

interface ApprovalItem {
  id: string;
  milestoneId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
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
  const { data: approvalsData, isLoading } = useApprovals(projectId, milestoneId);
  const requestApprovalMutation = useRequestApproval(projectId);
  const respondApprovalMutation = useRespondApproval(projectId);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [isRespondOpen, setIsRespondOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [responseNote, setResponseNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReenviando, setIsReenviando] = useState(false);

  const rawApprovals = Array.isArray(approvalsData)
    ? (approvalsData as unknown as ApprovalItem[])
    : ((approvalsData as unknown as { data?: ApprovalItem[] })?.data ?? []);

  // Ordena rigorosamente do mais recente para o mais antigo
  const sortedApprovals = useMemo(() => {
    return [...rawApprovals].sort((a, b) => {
      const timeA = new Date(a.requestedAt).getTime();
      const timeB = new Date(b.requestedAt).getTime();
      return timeB - timeA;
    });
  }, [rawApprovals]);

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
      toast.success('Solicitação de validação enviada ao cliente!');
      setIsRequestModalOpen(false);
      setRequestNote('');
    } catch {
      toast.error('Erro ao solicitar aprovação');
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
          ? 'Etapa aprovada com sucesso! Parabéns!'
          : 'Feedback enviado com solicitações de ajuste.'
      );
      setIsRespondOpen(false);
      setResponseNote('');
    } catch {
      toast.error('Erro ao responder aprovação');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return null;

  // Modal para o desenvolvedor adicionar comentário ao enviar/reenviar para validação
  const requestApprovalDialog = (
    <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            {latestApproval?.status === 'REJECTED'
              ? 'Reenviar Etapa para Validação'
              : 'Solicitar Validação da Etapa'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Etapa: <strong>{milestoneTitle}</strong>. Adicione orientações ou comentários para o cliente testar e aprovar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {latestApproval?.status === 'REJECTED' && latestApproval.responseNote && (
            <div className="rounded-md border border-rose-500/25 bg-rose-500/5 p-2.5 space-y-1">
              <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Último apontamento do cliente:
              </span>
              <p className="text-xs text-foreground italic leading-relaxed whitespace-pre-wrap">
                &ldquo;{latestApproval.responseNote}&rdquo;
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Mensagem ou orientações para o cliente (opcional)</span>
              <span className="text-[10px] text-muted-foreground">{requestNote.length}/2000</span>
            </label>
            <Textarea
              placeholder="Ex: Realizamos todas as tarefas desta etapa e os ajustes solicitados. Por favor, valide no ambiente de testes."
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
            Cancelar
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
            {latestApproval?.status === 'REJECTED' ? 'Reenviar para Validação' : 'Enviar para Validação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // 1. Nenhuma aprovação solicitada ainda
  if (!latestApproval) {
    if (!canEdit) return null;
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] text-muted-foreground hover:text-primary px-1.5"
          onClick={() => setIsRequestModalOpen(true)}
          title="Pedir para o cliente validar e aprovar esta etapa"
        >
          <ShieldCheck className="mr-1 h-3 w-3" />
          Pedir aprovação
        </Button>
        {requestApprovalDialog}
      </>
    );
  }

  // 2. Modal Compartilhado de Feedback do Cliente e Histórico
  const feedbackDialog = (
    <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            Feedback da Etapa: {milestoneTitle}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {latestApproval.status === 'REJECTED'
              ? 'O cliente solicitou ajustes nesta etapa. Veja as observações abaixo:'
              : 'Informações da validação desta etapa pelo cliente:'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card com a mensagem enviada pelo desenvolvedor nesta rodada */}
          {latestApproval.requestNote && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  Mensagem da Equipe de Desenvolvimento
                </span>
                {latestApproval.requestedAt && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {new Date(latestApproval.requestedAt).toLocaleDateString('pt-BR', {
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
                  Enviado por: {latestApproval.requestedBy.name}
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
                  Aguardando Avaliação do Cliente
                </span>
                {latestApproval.requestedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    Enviado em {new Date(latestApproval.requestedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta etapa foi enviada para validação e está aguardando análise e resposta por parte do cliente.
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
                      Solicitação de Ajustes do Cliente
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Etapa Aprovada pelo Cliente
                    </>
                  )}
                </span>

                {latestApproval.respondedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(latestApproval.respondedAt).toLocaleDateString('pt-BR', {
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
                    Nenhuma observação por escrito foi adicionada.
                  </span>
                )}
              </div>

              {latestApproval.respondedBy?.name && (
                <p className="text-[11px] text-muted-foreground text-right">
                  Respondido por: <strong>{latestApproval.respondedBy.name}</strong>
                </p>
              )}
            </div>
          )}

          {/* Histórico completo se houver mais de uma rodada de validação */}
          {sortedApprovals.length > 1 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-[11px] font-semibold text-muted-foreground">
                Histórico de Rodadas de Validação ({sortedApprovals.length})
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
                            <CheckCircle2 className="h-3 w-3" /> Aprovada
                          </span>
                        )}
                        {appr.status === 'REJECTED' && (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                            <XCircle className="h-3 w-3" /> Ajustes
                          </span>
                        )}
                        {appr.status === 'PENDING' && (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                            <Clock className="h-3 w-3" /> Pendente
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-[9px] text-primary font-semibold">
                            (Mais recente)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(appr.requestedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {appr.requestNote && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        <strong>Equipe:</strong> &ldquo;{appr.requestNote}&rdquo;
                      </p>
                    )}
                    {appr.responseNote && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        <strong>Cliente:</strong> &ldquo;{appr.responseNote}&rdquo;
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
            Fechar
          </Button>

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
              Reenviar para Aprovação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // 3. Status = APPROVED
  if (latestApproval.status === 'APPROVED') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsFeedbackOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          title="Etapa Aprovada pelo cliente. Clique para ver detalhes."
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
          <span>Etapa Aprovada</span>
          {(latestApproval.responseNote || latestApproval.requestNote) && (
            <MessageSquareText className="h-3 w-3 ml-0.5 text-emerald-600" />
          )}
        </button>
        {feedbackDialog}
        {requestApprovalDialog}
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
            title="Clique para ver o feedback detalhado do cliente"
          >
            <XCircle className="h-3 w-3 text-rose-500 flex-shrink-0" />
            <span>Ajustes Solicitados</span>
            <MessageSquareText className="h-3 w-3 ml-0.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
          </button>

          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] text-muted-foreground hover:text-primary px-1.5 gap-1"
              onClick={() => setIsRequestModalOpen(true)}
              title="Reenviar etapa para nova validação do cliente com comentário"
            >
              <RefreshCw className="h-3 w-3" />
              Reenviar
            </Button>
          )}
        </div>
        {feedbackDialog}
        {requestApprovalDialog}
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
          title="Clique para ver o status da validação e histórico"
          onClick={() => setIsFeedbackOpen(true)}
        >
          <Clock className="h-3 w-3" />
          Validação Pendente
          {latestApproval.requestNote && (
            <MessageSquareText className="h-3 w-3 ml-0.5 text-amber-600" />
          )}
        </Badge>
        {!canEdit && (
          <Button
            size="sm"
            variant="default"
            className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white font-medium"
            onClick={() => setIsRespondOpen(true)}
          >
            Avaliar Etapa
          </Button>
        )}
      </div>

      {feedbackDialog}
      {requestApprovalDialog}

      {/* Modal do Cliente para Avaliar e Responder */}
      <Dialog open={isRespondOpen} onOpenChange={setIsRespondOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Revisar e Aprovar Etapa
            </DialogTitle>
            <DialogDescription className="text-xs">
              Você está avaliando a etapa: <strong>{milestoneTitle}</strong>. Todas as tarefas foram entregues?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {latestApproval.requestNote && (
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Send className="h-3.5 w-3.5" />
                  Mensagem da Equipe de Desenvolvimento:
                </div>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {latestApproval.requestNote}
                </p>
                {latestApproval.requestedBy?.name && (
                  <p className="text-[10px] text-muted-foreground text-right">
                    Enviado por: {latestApproval.requestedBy.name}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Observações ou Feedback (opcional)
              </label>
              <Textarea
                placeholder="Ex: Tudo pronto! Ou: Ficou ótimo, mas gostaríamos de ajustar o banner."
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
              Solicitar Ajustes
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              onClick={() => handleRespond('APPROVED')}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Aprovar Etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
