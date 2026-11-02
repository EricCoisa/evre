'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  BarChart,
  Coins,
  Columns,
  Component,
  DollarSign,
  Globe,
  Image as ImageIcon,
  LineChart,
  List,
  ListChecks,
  Minus,
  MousePointerClick,
  Plus,
  Search,
  Table,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/cn';
import { BLOCK_META, isInlineBlockType, type BlockType } from '../blocks.meta';
import { LAYOUT_PROFILES } from '../profiles';
import { useEditorOrThrow } from './context';
import { findBlock, isContainerType } from './mutations';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  AreaChart,
  BarChart,
  Coins,
  Columns,
  DollarSign,
  Globe,
  ImageIcon,
  LineChart,
  List,
  ListChecks,
  Minus,
  MousePointerClick,
  Table,
  Type,
};

export function BlockInserter({
  index = 0,
  afterBlockId,
  gridSlot,
  parentId,
  alwaysVisible,
  variant = 'default',
  align = 'center',
  className,
}: {
  /** Posição linear onde o novo bloco será inserido. */
  index?: number;
  /** Se informado, insere logo após este bloco específico. */
  afterBlockId?: string;
  /** Se informado, insere exatamente nas coordenadas (x, y) e largura (span) deste espaço livre. */
  gridSlot?: { x: number; y: number; span: number };
  /** Se informado, insere dentro deste container. */
  parentId?: string;
  /** Quando `true`, mantém o botão `+` visível (ex: no espaço livre abaixo de um Texto na mesma célula). */
  alwaysVisible?: boolean;
  /** Variante visual: 'default' ou 'doodle' (divisor sutil com linha expansiva e botão circular) */
  variant?: 'default' | 'doodle';
  /** Alinhamento do botão: 'center' ou 'left' */
  align?: 'center' | 'left';
  className?: string;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const targetLocated = afterBlockId ? findBlock(editor.draft, afterBlockId) : undefined;
  const effectiveParentId = parentId ?? targetLocated?.parentId;

  const canAdd = editor.canAddTo(effectiveParentId);
  if (!canAdd) return null;

  const parentBlock = effectiveParentId
    ? editor.draft.blocks.find((b) => b.id === effectiveParentId)
    : undefined;
  const parentOnlyAcceptsInline =
    !!parentBlock && !isContainerType(parentBlock.type);

  const availableBlockTypes = LAYOUT_PROFILES[editor.profile].blocks;

  const filteredBlocks = availableBlockTypes
    .map((type) => {
      const meta = BLOCK_META[type];
      const iconComponent = meta?.icon && meta.icon in ICON_MAP ? ICON_MAP[meta.icon] : Component;
      return {
        type,
        icon: iconComponent,
        titleKey: `blocks.${type}`,
        defaultTitle: type,
        description: meta?.description ?? '',
      };
    })
    .filter((item) => {
      if (effectiveParentId && isContainerType(item.type)) return false;
      if (parentOnlyAcceptsInline && !isInlineBlockType(item.type)) return false;

      const query = search.trim().toLowerCase();
      if (!query) return true;
      const name = t(item.titleKey, { defaultValue: item.defaultTitle }).toLowerCase();
      const desc = item.description.toLowerCase();
      return name.includes(query) || desc.includes(query) || item.type.includes(query);
    });

  const handleSelect = (type: BlockType) => {
    if (afterBlockId) {
      editor.insertAfter(afterBlockId, type);
    } else if (gridSlot) {
      editor.insertAtGrid(type, gridSlot.x, gridSlot.y, gridSlot.span, effectiveParentId);
    } else {
      editor.insertAt(type, index, effectiveParentId);
    }
    setOpen(false);
    setSearch('');
  };

  const isDoodle = variant === 'doodle';

  return (
    <div
      className={cn(
        'group/inserter relative flex items-center transition-all',
        gridSlot ? 'h-full w-full justify-center' : isDoodle ? 'w-full h-full justify-start' : 'col-span-full h-5 justify-center',
        open && !gridSlot && (isDoodle ? 'z-40' : 'z-30 h-8'),
        className,
      )}
    >
      {/* Linha guia suave (apenas no modo de linha divisória) */}
      {!gridSlot && !alwaysVisible ? (
        <div
          onClick={() => isDoodle && setOpen(true)}
          className={cn(
            'absolute transition-all duration-200',
            isDoodle
              ? 'left-7 sm:left-8 right-0 h-0.5 rounded-full cursor-pointer pointer-events-auto'
              : 'inset-x-4 h-0.5 bg-transparent pointer-events-none',
            open
              ? 'bg-primary/70 shadow-xs'
              : 'bg-transparent group-hover/inserter:bg-primary/50',
          )}
        />
      ) : null}

      {/* Botão de Adicionar (+) */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={gridSlot || alwaysVisible ? 'sm' : 'icon'}
            className={cn(
              'border border-dashed border-primary/50 bg-background text-primary shadow-sm transition-all',
              gridSlot
                ? 'h-7 max-w-full gap-1 overflow-hidden rounded-full px-2 text-[11px] opacity-40 group-hover/slot:opacity-100 hover:opacity-100 hover:border-primary'
                : alwaysVisible
                  ? 'h-7 gap-1 rounded-full px-2.5 text-[11px] opacity-65 hover:opacity-100 hover:border-primary'
                : isDoodle
                  ? cn(
                      'relative z-10 size-6 sm:size-7 shrink-0 rounded-full border-2 border-primary/60 bg-background text-primary shadow-md',
                      'opacity-0 group-hover/inserter:opacity-100 group-hover/pb:opacity-30 hover:opacity-100! hover:scale-110 hover:border-primary hover:bg-primary hover:text-primary-foreground',
                    )
                  : 'size-6 rounded-full opacity-0 group-hover/inserter:opacity-100 group-hover/inserter:scale-105',
              open && 'opacity-100! scale-110 border-primary ring-2 ring-primary/30 bg-primary text-primary-foreground',
            )}
            title={t('editor.addBlock', { defaultValue: 'Inserir bloco aqui' })}
            aria-label={t('editor.addBlock', { defaultValue: 'Inserir bloco aqui' })}
          >
            <Plus className="size-3.5" />
            {gridSlot && gridSlot.span >= 3 ? (
              <span className="truncate">{t('editor.addHere', { defaultValue: 'Adicionar aqui' })}</span>
            ) : alwaysVisible ? (
              <span>{t('editor.addHere', { defaultValue: 'Adicionar aqui' })}</span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-80 p-3 shadow-xl border rounded-xl z-50"
          align={align === 'left' ? 'start' : 'center'}
          side="bottom"
          sideOffset={8}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" />
                <Input
                  autoFocus
                  placeholder={t('editor.searchBlocks', { defaultValue: 'Buscar bloco...' })}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {filteredBlocks.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">
                  {t('editor.noBlocksFound', { defaultValue: 'Nenhum bloco encontrado' })}
                </p>
              ) : (
                filteredBlocks.map((item) => {
                  const Icon = item.icon;
                  const title = t(item.titleKey, { defaultValue: item.defaultTitle });
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleSelect(item.type)}
                      className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground group/item"
                    >
                      <div className="rounded-md border bg-muted/60 p-1.5 text-muted-foreground group-hover/item:border-primary/40 group-hover/item:text-primary transition-colors">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{title}</p>
                        <p className="text-muted-foreground line-clamp-1 text-[11px]">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
