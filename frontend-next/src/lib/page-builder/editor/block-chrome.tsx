'use client';

import React, { useRef } from 'react';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Columns,
  Copy,
  GripVertical,
  MoveVertical,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/cn';
import {
  getMaxResizeBounds,
  resolveGridLayout,
  type EmptyGridSlot,
} from '../grid-engine';
import {
  COL_START_CLASS,
  QUICK_HEIGHTS,
  QUICK_WIDTHS,
  ROW_SPAN_CLASS,
  ROW_START_CLASS,
  SPAN_CLASS,
  minRowSpanForType,
  normalizeRowSpan,
  normalizeSpan,
  type PageBlock,
} from '../schema';
import { BlockInserter } from './block-inserter';
import { useEditorOrThrow } from './context';
import {
  canAcceptChildrenType,
  canDrop,
  isContainerType,
  isInlineBlockType,
} from './mutations';

export type DropPlacement = 'before' | 'after' | 'inside' | 'swap';
export const DROP_ID_SEPARATOR = '::';
export const GRID_SLOT_PREFIX = 'grid-slot';

export function dropId(placement: DropPlacement, blockId: string): string {
  return `${placement}${DROP_ID_SEPARATOR}${blockId}`;
}

export function parseDropId(
  id: string,
): { placement: DropPlacement; blockId: string } | null {
  const [placement, blockId] = id.split(DROP_ID_SEPARATOR);
  if (!blockId) return null;
  if (
    placement !== 'before' &&
    placement !== 'after' &&
    placement !== 'inside' &&
    placement !== 'swap'
  ) {
    return null;
  }
  return { placement, blockId };
}

export function gridSlotId(x: number, y: number, parentId?: string): string {
  return `${GRID_SLOT_PREFIX}${DROP_ID_SEPARATOR}${x}${DROP_ID_SEPARATOR}${y}${DROP_ID_SEPARATOR}${parentId ?? ''}`;
}

export function parseGridSlotId(
  id: string,
): { x: number; y: number; parentId?: string } | null {
  const parts = id.split(DROP_ID_SEPARATOR);
  if (parts[0] !== GRID_SLOT_PREFIX || parts.length < 3) return null;
  const x = Number(parts[1]);
  const y = Number(parts[2]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  const parentId = parts[3] ? parts[3] : undefined;
  return { x, y, parentId };
}

/** Toolbar flutuante contextual inspirada no WordPress Gutenberg e Excalidraw */
function FloatingBlockToolbar({
  block,
  nested,
  selected,
  attributes,
  listeners,
}: {
  block: PageBlock;
  nested?: boolean;
  selected: boolean;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const currentSpan = normalizeSpan(block.span);

  const isInline = isInlineBlockType(block.type);

  const located = editor.draft.blocks.some((b) => b.id === block.id)
    ? editor.draft.blocks
    : (editor.draft.blocks.find((b) => b.children?.some((c) => c.id === block.id))?.children ??
      editor.draft.blocks);
  const { maxSpan, maxRowSpan } = getMaxResizeBounds(located, block.id);
  const placedInList = resolveGridLayout(located).find((p) => p.block.id === block.id);
  const currentRowSpan = placedInList?.rowSpan ?? normalizeRowSpan(block.rowSpan, block.type);
  const alignRight =
    nested ||
    (placedInList ? placedInList.x + placedInList.span >= 9 && placedInList.x >= 4 : false);

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };

  return (
    <div
      className={cn(
        'bg-background absolute bottom-full mb-1.5 z-40 flex items-center gap-0.5 rounded-lg border border-border/80 p-1 shadow-md transition-all max-w-[calc(100vw-2rem)] whitespace-nowrap',
        alignRight ? 'right-0' : 'left-0',
        selected
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-95 pointer-events-none',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Alça de arraste */}
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none px-1 py-1 rounded active:cursor-grabbing hover:bg-muted"
        aria-label={t('editor.drag', { defaultValue: 'Arrastar bloco' })}
        title={t('editor.drag', { defaultValue: 'Arrastar bloco' })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Movimentação livre 2D na grade (Esquerda, Cima, Baixo, Direita) */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        title={t('editor.moveLeft', { defaultValue: 'Mover para a esquerda' })}
        onClick={stop(() => editor.nudgeGrid(block.id, 'left'))}
      >
        <ArrowLeft className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        title={t('editor.moveUp', { defaultValue: 'Mover para cima' })}
        onClick={stop(() => editor.nudgeGrid(block.id, 'up'))}
      >
        <ArrowUp className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        title={t('editor.moveDown', { defaultValue: 'Mover para baixo' })}
        onClick={stop(() => editor.nudgeGrid(block.id, 'down'))}
      >
        <ArrowDown className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        title={t('editor.moveRight', { defaultValue: 'Mover para a direita' })}
        onClick={stop(() => editor.nudgeGrid(block.id, 'right'))}
      >
        <ArrowRight className="size-3.5" />
      </Button>

      <div className="mx-0.5 h-3.5 w-px bg-border" />

      {/* Seletor rápido de largura (Grid 12 colunas) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground hover:text-foreground"
            title={t('editor.changeWidth', { defaultValue: 'Ajustar largura' })}
          >
            <Columns className="size-3" />
            <span>{`${Math.round((currentSpan / 12) * 100)}%`}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40 text-xs">
          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
            {t('editor.width', { defaultValue: 'Largura do bloco' })}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {QUICK_WIDTHS.map((w) => {
            const exceedsAvailable = w.span > maxSpan;
            return (
              <DropdownMenuItem
                key={w.span}
                disabled={exceedsAvailable}
                onClick={() => editor.setSpan(block.id, w.span)}
                className={cn(
                  'flex items-center justify-between text-xs',
                  currentSpan === w.span && 'font-semibold text-primary',
                )}
              >
                <span>{w.label}</span>
                <span className="text-[10px] text-muted-foreground">{w.span}/12 col</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Seletor rápido de altura (RowSpan) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground hover:text-foreground"
            title={t('editor.changeHeight', { defaultValue: 'Ajustar altura' })}
          >
            <MoveVertical className="size-3" />
            <span>{currentRowSpan}x</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40 text-xs">
          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
            {t('editor.height', { defaultValue: 'Altura do bloco' })}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {QUICK_HEIGHTS.map((h) => {
            const minRowSpan = minRowSpanForType(block.type);
            const disabledOption = h.rowSpan > maxRowSpan || h.rowSpan < minRowSpan;
            return (
              <DropdownMenuItem
                key={h.rowSpan}
                disabled={disabledOption}
                onClick={() => editor.setRowSpan(block.id, h.rowSpan)}
                className={cn(
                  'flex items-center justify-between text-xs',
                  currentRowSpan === h.rowSpan && 'font-semibold text-primary',
                )}
              >
                <span>{h.label}</span>
                <span className="text-[10px] text-muted-foreground">{h.rowSpan} lin</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-0.5 h-3.5 w-px bg-border" />

      {/* Duplicar Bloco */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        title={t('editor.duplicate', { defaultValue: 'Duplicar bloco' })}
        onClick={stop(() => editor.duplicate(block.id))}
      >
        <Copy className="size-3.5" />
      </Button>

      {/* Remover Bloco */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive size-6 hover:bg-destructive/10"
        title={t('editor.remove', { defaultValue: 'Remover bloco' })}
        onClick={stop(() => editor.remove(block.id))}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

/** Alças de redimensionamento interativas 2D nos 4 lados (Esquerda, Direita, Topo, Base e Canto estilo Excalidraw) */
function BlockResizeHandles({
  block,
  selected,
}: {
  block: PageBlock;
  selected: boolean;
}) {
  const editor = useEditorOrThrow();
  const currentSpan = normalizeSpan(block.span);

  const located = editor.draft.blocks.some((b) => b.id === block.id)
    ? editor.draft.blocks
    : (editor.draft.blocks.find((b) => b.children?.some((c) => c.id === block.id))?.children ??
      editor.draft.blocks);
  const placedInList = resolveGridLayout(located).find((p) => p.block.id === block.id);
  const currentRowSpan = placedInList?.rowSpan ?? normalizeRowSpan(block.rowSpan, block.type);
  const isDraggingRef = useRef(false);

  const startResize = (
    e: React.PointerEvent,
    handle: 'left' | 'right' | 'top' | 'bottom' | 'corner',
  ) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    e.preventDefault();
    editor.select(block.id);
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialSpan = currentSpan;
    const initialRowSpan = currentRowSpan;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (handle === 'right' || handle === 'corner') {
        const deltaCols = Math.round(deltaX / 45);
        const nextSpan = Math.min(12, Math.max(1, initialSpan + deltaCols));
        editor.setSpan(block.id, nextSpan);
      }
      if (handle === 'left') {
        const deltaCols = Math.round(-deltaX / 45);
        const nextSpan = Math.min(12, Math.max(1, initialSpan + deltaCols));
        editor.setSpanLeft(block.id, nextSpan);
      }
      if (handle === 'bottom' || handle === 'corner') {
        const deltaRows = Math.round(deltaY / 36);
        const nextRowSpan = Math.min(24, Math.max(1, initialRowSpan + deltaRows));
        editor.setRowSpan(block.id, nextRowSpan);
      }
      if (handle === 'top') {
        const deltaRows = Math.round(-deltaY / 36);
        const nextRowSpan = Math.min(24, Math.max(1, initialRowSpan + deltaRows));
        editor.setRowSpanTop(block.id, nextRowSpan);
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <>
      {/* Alça Lateral Esquerda (Largura pela esquerda) */}
      <div
        onPointerDown={(e) => startResize(e, 'left')}
        data-testid={`pb-resize-left-${block.id}`}
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 z-20 flex h-6 max-h-[70%] w-2 cursor-ew-resize items-center justify-center rounded-r-sm transition-all',
          selected
            ? 'opacity-100 bg-primary/80 hover:bg-primary'
            : 'opacity-0 group-hover/pb:opacity-70 hover:opacity-100 bg-muted-foreground/40 hover:bg-primary',
        )}
        title="Arrastar borda esquerda para ajustar largura"
      >
        <div className="h-3.5 w-0.5 rounded-full bg-background" />
      </div>

      {/* Alça Lateral Direita (Largura pela direita) */}
      <div
        onPointerDown={(e) => startResize(e, 'right')}
        data-testid={`pb-resize-right-${block.id}`}
        className={cn(
          'absolute right-0 top-1/2 -translate-y-1/2 z-20 flex h-6 max-h-[70%] w-2 cursor-ew-resize items-center justify-center rounded-l-sm transition-all',
          selected
            ? 'opacity-100 bg-primary/80 hover:bg-primary'
            : 'opacity-0 group-hover/pb:opacity-70 hover:opacity-100 bg-muted-foreground/40 hover:bg-primary',
        )}
        title="Arrastar borda direita para ajustar largura"
      >
        <div className="h-3.5 w-0.5 rounded-full bg-background" />
      </div>

      {/* Alça Superior (Altura por cima) */}
      <div
        onPointerDown={(e) => startResize(e, 'top')}
        data-testid={`pb-resize-top-${block.id}`}
        className={cn(
          'absolute top-0 left-1/2 -translate-x-1/2 z-20 flex h-2.5 w-12 cursor-ns-resize items-center justify-center rounded-b-sm transition-all',
          selected
            ? 'opacity-100 bg-primary/80 hover:bg-primary'
            : 'opacity-0 group-hover/pb:opacity-70 hover:opacity-100 bg-muted-foreground/40 hover:bg-primary',
        )}
        title="Arrastar borda superior para ajustar altura"
      >
        <div className="h-0.5 w-6 rounded-full bg-background" />
      </div>

      {/* Alça Inferior (Altura por baixo) */}
      <div
        onPointerDown={(e) => startResize(e, 'bottom')}
        data-testid={`pb-resize-bottom-${block.id}`}
        className={cn(
          'absolute bottom-0 left-1/2 -translate-x-1/2 z-20 flex h-2.5 w-12 cursor-ns-resize items-center justify-center rounded-t-sm transition-all',
          selected
            ? 'opacity-100 bg-primary/80 hover:bg-primary'
            : 'opacity-0 group-hover/pb:opacity-70 hover:opacity-100 bg-muted-foreground/40 hover:bg-primary',
        )}
        title="Arrastar borda inferior para ajustar altura"
      >
        <div className="h-0.5 w-6 rounded-full bg-background" />
      </div>

      {/* Alça de Canto Inferior Direito (Largura + Altura simultâneos estilo Excalidraw) */}
      <div
        onPointerDown={(e) => startResize(e, 'corner')}
        data-testid={`pb-resize-corner-${block.id}`}
        className={cn(
          'absolute bottom-0 right-0 z-25 size-4 cursor-nwse-resize rounded-tl-md rounded-br-xl border-2 border-background transition-all',
          selected
            ? 'opacity-100 bg-primary hover:scale-125'
            : 'opacity-0 group-hover/pb:opacity-80 hover:opacity-100 bg-primary/70 hover:scale-125',
        )}
        title="Arrastar canto para redimensionar livremente"
      />
    </>
  );
}

/**
 * Slot de espaço vazio na grade 2D:
 * - Durante o arrasto: funciona como alvo magnético para encaixar o bloco naquele espaço livre;
 * - Fora do arrasto: permite adicionar um bloco diretamente naquele espaço vazio.
 */
export function EmptySlotDropZone({
  slot,
  parentId,
}: {
  slot: EmptyGridSlot;
  parentId?: string;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const isDragging = !!editor.draggingId;

  const { setNodeRef, isOver } = useDroppable({
    id: gridSlotId(slot.x, slot.y, parentId),
    disabled: !isDragging,
  });

  const gridClass = cn(
    COL_START_CLASS[slot.x] ?? 'lg:col-start-1',
    SPAN_CLASS[slot.span] ?? 'lg:col-span-6',
    ROW_START_CLASS[slot.y] ?? '',
    ROW_SPAN_CLASS[slot.rowSpan] ?? 'lg:row-span-1',
  );

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        data-testid={`pb-grid-slot-${slot.x}-${slot.y}`}
        className={cn(
          gridClass,
          'min-h-[40px]',
          'pointer-events-auto flex items-center justify-center rounded-xl border-2 border-dashed transition-all duration-150',
          isOver
            ? 'border-primary bg-primary/15 ring-2 ring-primary/30 scale-[0.99] shadow-inner'
            : 'border-primary/35 bg-primary/5 hover:border-primary/60',
        )}
      >
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-all',
            isOver
              ? 'bg-primary text-primary-foreground shadow-sm scale-105'
              : 'text-primary/70 bg-background/80 border border-primary/20',
          )}
        >
          {t('editor.dropHere', { defaultValue: 'Soltar neste espaço' })}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid={`pb-grid-slot-${slot.x}-${slot.y}`}
      className={cn(
        gridClass,
        'group/slot min-h-[40px] overflow-hidden',
        'hidden lg:flex items-center justify-center rounded-xl border border-dashed border-border/40 bg-muted/5 hover:border-primary/50 hover:bg-primary/5 transition-all',
      )}
    >
      <BlockInserter
        gridSlot={{ x: slot.x, y: slot.y, span: slot.span }}
        parentId={parentId}
      />
    </div>
  );
}

/** Linha indicadora de drop elegante (Drop Line Indicator) */
function ModernDropZone({
  placement,
  blockId,
  enabled,
  label,
}: {
  placement: DropPlacement;
  blockId: string;
  enabled: boolean;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId(placement, blockId),
    disabled: !enabled,
  });

  if (!enabled) return null;

  if (placement === 'inside' || placement === 'swap') {
    const isSwap = placement === 'swap';
    return (
      <div
        ref={setNodeRef}
        data-testid={`pb-drop-${placement}-${blockId}`}
        aria-label={label}
        className={cn(
          'pointer-events-auto absolute inset-1.5 z-20 rounded-xl border-2 border-dashed transition-all duration-150 flex items-center justify-center',
          isOver
            ? 'border-primary bg-primary/15 backdrop-blur-[1px] shadow-inner scale-[0.99]'
            : 'border-primary/25 bg-primary/5',
        )}
      >
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all',
            isOver
              ? 'bg-primary text-primary-foreground scale-105 shadow-md'
              : 'bg-background/90 text-primary border border-primary/25',
          )}
        >
          {isSwap ? <ArrowLeftRight className="size-3.5" /> : null}
          {label}
        </span>
      </div>
    );
  }

  const isTop = placement === 'before';

  return (
    <div
      ref={setNodeRef}
      data-testid={`pb-drop-${placement}-${blockId}`}
      aria-label={label}
      className={cn(
        'pointer-events-auto absolute inset-x-0 z-25 h-7 transition-all flex items-center justify-center',
        isTop ? '-top-3.5' : '-bottom-3.5',
      )}
    >
      <div
        className={cn(
          'h-1.5 w-full rounded-full transition-all relative',
          isOver ? 'bg-primary ring-2 ring-primary/30 shadow-md' : 'bg-transparent',
        )}
      >
        {isOver ? (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm whitespace-nowrap">
            {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Casca visual do bloco com Toolbar Flutuante, Alças de Resize 2D e Zonas de Drop */
export function BlockChrome({
  block,
  spanClass,
  nested,
  children,
}: {
  block: PageBlock;
  spanClass: string;
  nested?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const draggingId = editor.draggingId;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const selected = editor.selectedId === block.id;
  const isContainer = isContainerType(block.type);
  const isInline = isInlineBlockType(block.type);
  
  const isChildSelected = (block.children ?? []).some((c) => c.id === editor.selectedId);
  const hasInteractiveChildren = isContainer || (block.children?.length ?? 0) > 0;
  const canReceiveChildren = !nested && canAcceptChildrenType(block.type);
  const showChildInserter =
    isContainer || (!isContainer && canReceiveChildren && selected);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    editor.select(block.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        spanClass,
        'group/pb relative rounded-xl transition-all',
        'h-full',
        selected
          ? 'ring-2 ring-primary shadow-md ring-offset-2'
          : 'hover:ring-1 hover:ring-primary/40',
        nested ? 'ring-inset' : '',
        isDragging && 'z-50 opacity-50 scale-[0.98]',
      )}
      onClick={handleSelect}
      data-testid={`pb-block-${block.id}`}
    >
      {/* Toolbar Flutuante Contextual */}
      <FloatingBlockToolbar
        block={block}
        nested={nested}
        selected={selected}
        attributes={attributes as unknown as Record<string, unknown>}
        listeners={listeners as unknown as Record<string, unknown>}
      />

      {/* Conteúdo Renderizado do Bloco */}
      <div
        data-pb-content=""
        className={cn(
          'h-full',
          !hasInteractiveChildren && 'pointer-events-none',
        )}
      >
        {children}
      </div>

      {/* Alças 2D para Redimensionar Largura e Altura */}
      <BlockResizeHandles block={block} selected={selected} />

      {/* Inserção rápida dentro de um container (Grupo) ou quando selecionado em um bloco que aceite micro-elementos */}
      {showChildInserter ? (
        <div
          className={cn(
            'flex items-center justify-center',
            isContainer ? 'mt-3' : 'mt-1.5 pb-1',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <BlockInserter
            index={block.children?.length ?? 0}
            parentId={block.id}
            className="h-8 opacity-80 hover:opacity-100"
          />
        </div>
      ) : null}

      {/* Mensagem em container vazio */}
      {isContainer && block.children?.length === 0 ? (
        <p className="text-muted-foreground pb-2 text-center text-xs">
          {t('editor.emptyContainer', { defaultValue: 'Container vazio. Use o botão + para adicionar blocos.' })}
        </p>
      ) : null}

      {/* Zonas de Drop Limpas e Fluidas */}
      {draggingId && draggingId !== block.id ? (
        <>
          <ModernDropZone
            placement="before"
            blockId={block.id}
            enabled={canDrop(editor.draft, draggingId, block.id, 'before')}
            label={t('editor.dropBefore', { defaultValue: 'Inserir antes' })}
          />
          {canDrop(editor.draft, draggingId, block.id, 'inside') ? (
            <ModernDropZone
              placement="inside"
              blockId={block.id}
              enabled={true}
              label={t('editor.dropInside', { defaultValue: 'Inserir dentro' })}
            />
          ) : (
            <ModernDropZone
              placement="swap"
              blockId={block.id}
              enabled={canDrop(editor.draft, draggingId, block.id, 'swap')}
              label={t('editor.dropSwap', { defaultValue: 'Trocar de posição' })}
            />
          )}
          <ModernDropZone
            placement="after"
            blockId={block.id}
            enabled={canDrop(editor.draft, draggingId, block.id, 'after')}
            label={t('editor.dropAfter', { defaultValue: 'Inserir depois' })}
          />
        </>
      ) : null}
    </div>
  );
}

/** Conteúdo do drag preview flutuante ao mover com mouse */
export function DragPreview({ block }: { block: PageBlock }) {
  const label =
    (typeof block.props?.title === 'string' && block.props.title) ||
    (typeof block.props?.label === 'string' && block.props.label) ||
    undefined;

  return (
    <div
      data-testid="pb-drag-preview"
      className="bg-background/95 ring-primary flex cursor-grabbing items-center gap-2 rounded-xl px-4 py-2.5 shadow-2xl ring-2 backdrop-blur"
    >
      <GripVertical className="text-primary size-4" />
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-foreground">{label ?? block.type}</span>
        {label ? (
          <span className="text-muted-foreground text-[10px]">{block.type}</span>
        ) : null}
      </div>
    </div>
  );
}

export function SortableList({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode;
}) {
  return (
    <SortableContext items={ids} strategy={() => null}>
      {children}
    </SortableContext>
  );
}
