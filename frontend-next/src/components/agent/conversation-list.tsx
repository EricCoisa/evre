"use client";

import { memo, useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { useAiConversationList, useDeleteConversation } from '@/lib/actions/ai/queries';
import ConversationItem from './conversation-item';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Plus, Trash2, X } from 'lucide-react';

interface ConversationListProps {
  selectedId: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  collapsed?: boolean;
  onClose?: () => void;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Set novo com `id` incluído ou removido — o `Set` do estado nunca é mutado. */
function toggleInSet(current: Set<string>, id: string, on: boolean): Set<string> {
  const next = new Set(current);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

/** Texto do diálogo: o mesmo fluxo serve para uma conversa ou para um lote. */
function confirmCopy(t: Translate, count: number) {
  return count > 1
    ? {
        title: t('deleteConversations'),
        description: t('confirmDeleteMany', { count }),
      }
    : { title: t('deleteConversation'), description: t('confirmDelete') };
}

function ConversationListHeader({
  onCreate,
  selectionCount,
  onDeleteSelected,
  onClose,
  t,
}: {
  onCreate: () => void;
  selectionCount: number;
  onDeleteSelected: () => void;
  onClose?: () => void;
  t: Translate;
}) {
  const selectionMode = selectionCount > 0;
  return (
    <div className="flex items-center gap-2 p-2 border-b">
      <Button
        size="sm"
        variant="outline"
        className="flex-1 justify-start text-xs"
        onClick={onCreate}
      >
        <Plus className="mr-1 size-3.5" />
        {t('newConversation')}
      </Button>

      {selectionMode && (
        <Button
          size="sm"
          variant="destructive"
          onClick={onDeleteSelected}
          title={t('deleteSelected')}
          aria-label={t('deleteSelected')}
        >
          <Trash2 className="size-3.5" />
          {selectionCount}
        </Button>
      )}

      {onClose && (
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onClose}
          title={t('close') || 'Fechar'}
          aria-label={t('close') || 'Fechar'}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

function ConversationList({
  selectedId,
  onSelectConversation,
  onDeleteConversation,
  collapsed = false,
  onClose,
}: ConversationListProps) {
  const { t } = useTranslation('agent');
  const { data, isLoading } = useAiConversationList();
  const deleteMutation = useDeleteConversation();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);

  const conversations = data?.data ?? [];
  const checkedConversations = conversations.filter((c) => checkedIds.has(c.id));
  const selectionMode = checkedConversations.length > 0;

  const handleCreate = () => onSelectConversation('');

  const toggleChecked = (id: string, checked: boolean) =>
    setCheckedIds((prev) => toggleInSet(prev, id, checked));

  const handleConfirmDelete = async () => {
    if (!pendingIds?.length) return;
    try {
      for (const id of pendingIds) {
        await deleteMutation.mutateAsync(id);
        onDeleteConversation(id);
        setCheckedIds((prev) => toggleInSet(prev, id, false));
      }
    } catch {
      // toast já exibido; evita unhandled rejection
    } finally {
      setPendingIds(null);
    }
  };

  if (collapsed) return null;

  const confirm = confirmCopy(t, pendingIds?.length ?? 0);

  return (
    <div className="flex h-full w-full sm:w-60 lg:w-64 shrink-0 flex-col border-r bg-card">
      <ConversationListHeader
        onCreate={handleCreate}
        selectionCount={checkedConversations.length}
        onDeleteSelected={() => setPendingIds(checkedConversations.map((c) => c.id))}
        onClose={onClose}
        t={t}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
        {isLoading && <p className="px-2 text-xs text-muted-foreground">{t('loading')}</p>}

        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            id={conv.id}
            title={conv.title || t('newConversation')}
            selected={selectedId === conv.id}
            checked={checkedIds.has(conv.id)}
            selectionMode={selectionMode}
            onSelect={onSelectConversation}
            onDelete={(id) => setPendingIds([id])}
            onCheckedChange={toggleChecked}
          />
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingIds}
        onOpenChange={(v) => !v && setPendingIds(null)}
        onConfirm={handleConfirmDelete}
        title={confirm.title}
        description={confirm.description}
      />
    </div>
  );
}

export default memo(ConversationList);
