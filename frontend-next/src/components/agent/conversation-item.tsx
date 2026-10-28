"use client";

import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ConversationItemProps {
  id: string;
  title: string;
  selected: boolean;
  /** Marcada para exclusão em lote (não confundir com `selected`, que é a conversa aberta). */
  checked: boolean;
  /** Alguma conversa marcada: os checkboxes ficam visíveis em todas, não só na que está sob o mouse. */
  selectionMode: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCheckedChange: (id: string, checked: boolean) => void;
}

const ConversationItem = ({
  id,
  title,
  selected,
  checked,
  selectionMode,
  onSelect,
  onDelete,
  onCheckedChange,
}: ConversationItemProps) => {
  const { t } = useTranslation('agent');

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group/item flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground',
      )}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(id);
        }
      }}
    >
      {/* Fora do modo seleção o checkbox só aparece no hover/foco — a lista fica
          limpa, mas basta passar o mouse para começar a marcar. */}
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(id, v === true)}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('selectConversation')}
        className={cn(
          'transition-opacity',
          selectionMode || checked
            ? 'opacity-100'
            : 'opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100',
        )}
      />

      <span className="min-w-0 flex-1 truncate">{title}</span>

      {/* Com seleção ativa, apagar é pelo botão do topo — dois caminhos de
          exclusão ao mesmo tempo só confundem. */}
      {!selectionMode && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          title={t('deleteConversation')}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
};

export default ConversationItem;
