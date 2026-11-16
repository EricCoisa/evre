'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextInput } from '@/components/rich-text-input';
import { useCreateTask, useProjectMembers } from '@/lib/actions/project/queries';
import { useMe } from '@/lib/actions/auth/queries';
import { UserAvatar } from './user-avatar';
import { TASK_STATUS_CONFIG } from './milestone-progress';
import { Plus, Loader2, AlertTriangle, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';
import type { ProjectTaskStatus } from '@/lib/actions/project/types';
import Modal from '@/components/modal';

function resolveTaskAssigneeId(assigneeId: string, creatorId?: string): string | null | undefined {
  if (assigneeId === '__UNASSIGNED__') return null;
  if (assigneeId === '__CREATOR__') return creatorId ?? undefined;
  if (assigneeId) return assigneeId;
  return undefined;
}

function isCreateTaskDisabled(isSubmitting: boolean, title: string, status: ProjectTaskStatus, blockedReason: string): boolean {
  if (isSubmitting || !title.trim()) return true;
  return status === 'BLOCKED' && !blockedReason.trim();
}

function resolveDefaultMilestoneId(
  initialMilestoneId: string | undefined,
  availableMilestones: { id: string; title: string }[]
): string {
  return initialMilestoneId ?? (availableMilestones.length > 0 ? availableMilestones[0].id : '');
}

interface CreateTaskDialogProps {
  projectId: string;
  milestoneId?: string;
  milestoneTitle?: string;
  availableMilestones?: { id: string; title: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateTaskDialog({
  projectId,
  milestoneId: initialMilestoneId,
  milestoneTitle: initialMilestoneTitle,
  availableMilestones = [],
  open,
  onOpenChange,
  onSuccess,
}: CreateTaskDialogProps) {
  const { t } = useTranslation('project');
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('taskCreateTitle')}
      description={
        initialMilestoneTitle
          ? t('taskCreateDescriptionMilestone', { milestone: initialMilestoneTitle })
          : t('taskCreateDescription')
      }
    >
      {open && (
        <CreateTaskDialogContent
          projectId={projectId}
          initialMilestoneId={initialMilestoneId}
          availableMilestones={availableMilestones}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}

function CreateTaskDialogContent({
  projectId,
  initialMilestoneId,
  availableMilestones,
  onClose,
  onSuccess,
}: {
  projectId: string;
  initialMilestoneId?: string;
  availableMilestones: { id: string; title: string }[];
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation('project');
  const createTaskMutation = useCreateTask(projectId);
  const { data: meData } = useMe();
  const { data: membersData } = useProjectMembers(projectId);
  const users = useMemo(() => membersData ?? [], [membersData]);

  const [selectedMilestoneId, setSelectedMilestoneId] = useState(() =>
    resolveDefaultMilestoneId(initialMilestoneId, availableMilestones)
  );
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ProjectTaskStatus>('WAITING');
  const [blockedReason, setBlockedReason] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>(() => meData?.id ?? '__CREATOR__');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const richTextFormatLabels = useMemo(() => ({
    bold: t('richTextBold'),
    italic: t('richTextItalic'),
    strikethrough: t('richTextStrikethrough'),
    code: t('richTextCode'),
  }), [t]);

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { toast.error(t('taskValidationTitle')); return; }
    if (!selectedMilestoneId) { toast.error(t('taskValidationMilestone')); return; }
    if (status === 'BLOCKED' && !blockedReason.trim()) { toast.error(t('taskValidationBlockedReason')); return; }

    const resolvedAssigneeId = resolveTaskAssigneeId(assigneeId, meData?.id);
    setIsSubmitting(true);
    try {
      await createTaskMutation.mutateAsync({
        milestoneId: selectedMilestoneId,
        data: {
          title: trimmedTitle,
          status,
          blockedReason: status === 'BLOCKED' ? blockedReason.trim() : undefined,
          assigneeId: resolvedAssigneeId,
          description: description.trim() || undefined,
        },
      });
      toast.success(t('boardTaskCreatedToast'));
      onClose();
      onSuccess?.();
    } catch {
      toast.error(t('boardTaskCreateErrorToast'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusList: ProjectTaskStatus[] = ['WAITING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];

  return (
    <div className="space-y-4">
      {availableMilestones.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {t('taskMilestoneLabel')} <span className="text-destructive">*</span>
          </label>
          <Select value={selectedMilestoneId} onValueChange={setSelectedMilestoneId} disabled={isSubmitting}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={t('taskMilestonePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {availableMilestones.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          {t('taskTitleLabel')} <span className="text-destructive">*</span>
        </label>
        <Input
          placeholder={t('taskTitlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xs h-9"
          autoFocus
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">{t('taskStatusLabel')}</label>
          <Select value={status} onValueChange={(val) => setStatus(val as ProjectTaskStatus)} disabled={isSubmitting}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusList.map((st) => {
                const conf = TASK_STATUS_CONFIG[st];
                const Icon = conf.icon;
                return (
                  <SelectItem key={st} value={st} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      <span>{conf.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center justify-between">
            <span>{t('taskAssigneeLabel')}</span>
            <span className="text-[10px] text-muted-foreground font-normal">{t('taskAssigneeDefault')}</span>
          </label>
          <Select value={assigneeId} onValueChange={setAssigneeId} disabled={isSubmitting}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={t('taskAssigneePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {meData && (
                <SelectItem value={meData.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={meData.name} email={meData.email} imageUrl={meData.imageUrl} className="h-4 w-4 text-[9px]" />
                    <span className="font-medium truncate">{meData.name || meData.email} {t('taskAssigneeYouCreator')}</span>
                  </div>
                </SelectItem>
              )}
              <SelectItem value="__UNASSIGNED__" className="text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <UserX className="h-3.5 w-3.5" />
                  <span>{t('boardUnassigned')}</span>
                </div>
              </SelectItem>
              {users.filter((u) => u.id !== meData?.id).map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={u.name} email={u.email} imageUrl={u.imageUrl} className="h-4 w-4 text-[9px]" />
                    <span className="truncate">{u.name || u.email}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {status === 'BLOCKED' && (
        <div className="space-y-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{t('taskBlockedReasonLabel')} <span className="text-destructive">*</span></span>
          </div>
          <Textarea
            placeholder={t('taskBlockedReasonPlaceholder')}
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            className="text-xs min-h-20 bg-background"
            disabled={isSubmitting}
          />
          <p className="text-[11px] text-muted-foreground">
            {t('taskBlockedReasonDescription')}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground flex items-center justify-between">
          <span>{t('taskDescriptionLabel')}</span>
          <span className="text-[10px] text-muted-foreground">Rich Text</span>
        </label>
        <RichTextInput
          ariaLabel={t('taskDescriptionAriaLabel')}
          value={description}
          onChange={setDescription}
          placeholder={t('taskDescriptionPlaceholder')}
          className="min-h-28 text-xs"
          formatLabels={richTextFormatLabels}
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-border/50">
        <Button
          type="button"
          onClick={handleCreate}
          disabled={isCreateTaskDisabled(isSubmitting, title, status, blockedReason)}
        >
          {isSubmitting ? <Loader2 className="animate-spin mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
          {t('taskCreateButton')}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
