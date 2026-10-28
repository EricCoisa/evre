'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/actions/auth/queries';
import {
  useSavePageLayout,
  useSaveSystemPageLayout,
} from '@/lib/actions/pageBuilder/queries';
import { BlockGrid } from '../renderer';
import type { PageLayout } from '../schema';
import {
  DragPreview,
  SortableList,
  parseDropId,
  parseGridSlotId,
} from './block-chrome';
import { BlockInserter } from './block-inserter';
import { EditorProvider, useEditorOrThrow } from './context';
import { findBlock } from './mutations';
import { EditorPanel } from './panel';
import { EditorTopBar } from './top-bar';

/** Modo de edição da página: renderiza os blocos reais com o chrome de edição por cima. */
export default function PageEditor({
  pageKey,
  initial,
  onExit,
}: {
  pageKey: string;
  initial: PageLayout;
  onExit: () => void;
}) {
  return (
    <EditorProvider initial={initial}>
      <EditorShell pageKey={pageKey} onExit={onExit} />
    </EditorProvider>
  );
}

function EditorShell({
  pageKey,
  onExit,
}: {
  pageKey: string;
  onExit: () => void;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const save = useSavePageLayout();
  const saveAsDefault = useSaveSystemPageLayout();
  const { data: me } = useMe();
  const isAdmin = me?.role === 'ADMIN';

  // Painel lateral de propriedades e catálogo rápido
  const [panelOpen, setPanelOpen] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const activeId = editor.draggingId;
  const activeBlock = activeId ? findBlock(editor.draft, activeId)?.block : undefined;

  const handleDragStart = ({ active }: DragStartEvent) => {
    editor.setDraggingId(String(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    editor.setDraggingId(null);
    if (!over) return;

    // 1. Soltou em um espaço livre da grade 2D (EmptySlotDropZone)
    const gridSlot = parseGridSlotId(String(over.id));
    if (gridSlot) {
      editor.moveToGrid(
        String(active.id),
        gridSlot.x,
        gridSlot.y,
        gridSlot.parentId,
      );
      return;
    }

    // 2. Soltou em uma zona de destino de um bloco existente (before, inside, after, swap)
    const drop = parseDropId(String(over.id));
    if (drop) {
      editor.moveTo(String(active.id), drop.blockId, drop.placement);
      return;
    }

    // 3. Fallback: se o dnd-kit reportar o ID direto do bloco sobre o qual o mouse soltou,
    // executa a troca de posição e tamanho (swap) com ele!
    const overBlockId = String(over.id);
    if (overBlockId !== String(active.id) && findBlock(editor.draft, overBlockId)) {
      editor.moveTo(String(active.id), overBlockId, 'swap');
    }
  };

  const handleDragCancel = () => editor.setDraggingId(null);

  const handleSave = () => {
    save.mutate(
      { pageKey, layout: editor.draft },
      {
        onSuccess: () => {
          toast.success(t('editor.saved', { defaultValue: 'Layout salvo com sucesso!' }));
          onExit();
        },
      },
    );
  };

  const handleSaveAsDefault = () => {
    if (!window.confirm(t('editor.saveAsDefaultConfirm', { defaultValue: 'Deseja definir este layout como padrão para todos os usuários?' }))) return;
    saveAsDefault.mutate(
      { pageKey, layout: editor.draft },
      {
        onSuccess: () => {
          toast.success(t('editor.savedAsDefault', { defaultValue: 'Layout salvo como padrão do sistema!' }));
          onExit();
        },
      },
    );
  };

  const handleCancel = () => {
    if (editor.dirty && !window.confirm(t('editor.discardConfirm', { defaultValue: 'Existem alterações não salvas. Deseja realmente sair?' }))) return;
    onExit();
  };

  return (
    <div
      className={cn(
        'relative min-h-[calc(100vh-4rem)] flex flex-col bg-muted/10 -m-4 sm:-m-6 lg:-m-8 transition-all duration-300',
        panelOpen ? 'lg:pr-80' : '',
      )}
    >
      {/* Barra de Ferramentas Superior (WordPress/Excalidraw Style) */}
      <EditorTopBar
        pageKey={pageKey}
        dirty={editor.dirty}
        saving={save.isPending || saveAsDefault.isPending}
        onSave={handleSave}
        onSaveAsDefault={isAdmin ? handleSaveAsDefault : undefined}
        onCancel={handleCancel}
        onOpenPanel={() => setPanelOpen((prev) => !prev)}
      />

      {/* Área do Canvas de Edição — clicar fora dos blocos limpa a seleção e fecha a toolbar ativa */}
      <div
        className="flex-1 p-4 sm:p-6 lg:p-8"
        onClick={() => editor.select(null)}
      >
        <div className="mx-auto max-w-7xl space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {editor.draft.blocks.length > 0 ? (
              <div className="space-y-3">
                {/* Ponto de inserção inicial no topo */}
                <BlockInserter index={0} />

                <SortableList ids={editor.draft.blocks.map((b) => b.id)}>
                  <BlockGrid blocks={editor.draft.blocks} />
                </SortableList>

                {/* Ponto de inserção no final da página */}
                <BlockInserter index={editor.draft.blocks.length} />
              </div>
            ) : (
              /* Estado Vazio Amigável para Leigos */
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-background/50 p-12 text-center shadow-xs">
                <div className="rounded-2xl border bg-muted/60 p-4 shadow-inner mb-4">
                  <LayoutGrid className="size-8 text-primary/80" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {t('editor.emptyTitle', { defaultValue: 'Página em branco' })}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  {t('editor.emptyPage')}
                </p>
                <BlockInserter index={0} className="h-auto opacity-100" />
              </div>
            )}

            <DragOverlay>
              {activeBlock ? <DragPreview block={activeBlock} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Painel Lateral Retrátil de Propriedades Avançadas */}
      {panelOpen ? (
        <EditorPanel
          pageKey={pageKey}
          dirty={editor.dirty}
          saving={save.isPending || saveAsDefault.isPending}
          onSave={handleSave}
          onSaveAsDefault={isAdmin ? handleSaveAsDefault : undefined}
          onCancel={handleCancel}
        />
      ) : null}
    </div>
  );
}
