'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { BlockType } from '../blocks.meta';
import type { PageBlock, PageLayout } from '../schema';
import {
  addBlock,
  canAdd,
  createBlock,
  duplicateBlock,
  findBlock,
  insertBlockAt,
  insertBlockAtGrid,
  moveBlock,
  moveBlockStep,
  moveBlockTo,
  moveBlockToGrid,
  nudgeBlockGrid,
  type DropPlacement,
  removeBlock,
  setBlockParam,
  setBlockProp,
  setBlockRowSpan,
  setBlockRowSpanTop,
  setBlockSource,
  setBlockSpan,
  setBlockSpanLeft,
  updateBlock,
  type Located,
} from './mutations';

/** Estado do editor: rascunho local do layout, histórico (Undo/Redo) e controles de seleção. */
export interface EditorContextValue {
  draft: PageLayout;
  dirty: boolean;
  selectedId: string | null;
  /** Bloco sendo arrastado agora; as zonas de destino só existem durante o arrasto. */
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  selected: Located | undefined;
  select: (id: string | null) => void;
  add: (type: BlockType, parentId?: string) => void;
  insertAt: (type: BlockType, index: number, parentId?: string) => void;
  insertAtGrid: (
    type: BlockType,
    x: number,
    y: number,
    span?: number,
    parentId?: string,
  ) => void;
  duplicate: (id: string) => void;
  moveStep: (id: string, direction: 'up' | 'down') => void;
  moveToGrid: (
    activeId: string,
    x: number,
    y: number,
    parentId?: string,
  ) => void;
  nudgeGrid: (
    id: string,
    direction: 'left' | 'right' | 'up' | 'down',
  ) => void;
  setSpan: (id: string, span: number) => void;
  setSpanLeft: (id: string, span: number) => void;
  setRowSpan: (id: string, rowSpan: number) => void;
  setRowSpanTop: (id: string, rowSpan: number) => void;
  remove: (id: string) => void;
  move: (activeId: string, overId: string) => void;
  moveTo: (activeId: string, targetId: string, placement: DropPlacement) => void;
  patch: (id: string, patch: Partial<PageBlock>) => void;
  setProp: (id: string, name: string, value: unknown) => void;
  setSource: (id: string, source: string | undefined) => void;
  setParam: (id: string, name: string, value: unknown) => void;
  canAddTo: (parentId?: string) => boolean;
  /** Histórico */
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

/** `null` fora do modo de edição — é assim que o renderer sabe se desenha o chrome. */
export function useEditor(): EditorContextValue | null {
  return useContext(EditorContext);
}

export function useEditorOrThrow(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorOrThrow fora de <EditorProvider>');
  return ctx;
}

export function EditorProvider({
  initial,
  children,
}: {
  initial: PageLayout;
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<PageLayout>(initial);
  const [past, setPast] = useState<PageLayout[]>([]);
  const [future, setFuture] = useState<PageLayout[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const applyChange = useCallback((updater: (current: PageLayout) => PageLayout) => {
    setDraft((current) => {
      const next = updater(current);
      if (next === current) return current;
      setPast((prevPast) => [...prevPast.slice(-30), current]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      const newPast = p.slice(0, -1);
      setFuture((f) => [draft, ...f]);
      setDraft(previous);
      return newPast;
    });
  }, [draft]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      const newFuture = f.slice(1);
      setPast((p) => [...p, draft]);
      setDraft(next);
      return newFuture;
    });
  }, [draft]);

  // Atalhos de teclado universais: Ctrl+Z / Cmd+Z e Ctrl+Y / Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const value = useMemo<EditorContextValue>(() => {
    const selected = selectedId ? findBlock(draft, selectedId) : undefined;

    return {
      draft,
      dirty: JSON.stringify(draft) !== JSON.stringify(initial),
      selectedId,
      draggingId,
      setDraggingId,
      selected,
      select: setSelectedId,
      add: (type, parentId) => {
        const block = createBlock(type, parentId);
        applyChange((d) => addBlock(d, block, parentId));
        setSelectedId(block.id);
      },
      insertAt: (type, index, parentId) => {
        const block = createBlock(type, parentId);
        applyChange((d) => insertBlockAt(d, block, index, parentId));
        setSelectedId(block.id);
      },
      insertAtGrid: (type, x, y, span, parentId) => {
        const block = createBlock(type, parentId);
        applyChange((d) => insertBlockAtGrid(d, block, x, y, span, parentId));
        setSelectedId(block.id);
      },
      duplicate: (id) => {
        let createdId: string | null = null;
        applyChange((d) => {
          const res = duplicateBlock(d, id);
          if (!res) return d;
          createdId = res.newId;
          return res.layout;
        });
        if (createdId) setSelectedId(createdId);
      },
      moveStep: (id, direction) => {
        applyChange((d) => moveBlockStep(d, id, direction));
      },
      moveToGrid: (activeId, x, y, parentId) => {
        applyChange((d) => moveBlockToGrid(d, activeId, x, y, parentId));
      },
      nudgeGrid: (id, direction) => {
        applyChange((d) => nudgeBlockGrid(d, id, direction));
      },
      setSpan: (id, span) => {
        applyChange((d) => setBlockSpan(d, id, span));
      },
      setSpanLeft: (id, span) => {
        applyChange((d) => setBlockSpanLeft(d, id, span));
      },
      setRowSpan: (id, rowSpan) => {
        applyChange((d) => setBlockRowSpan(d, id, rowSpan));
      },
      setRowSpanTop: (id, rowSpan) => {
        applyChange((d) => setBlockRowSpanTop(d, id, rowSpan));
      },
      remove: (id) => {
        applyChange((d) => removeBlock(d, id));
        setSelectedId((current) => (current === id ? null : current));
      },
      move: (activeId, overId) => applyChange((d) => moveBlock(d, activeId, overId)),
      moveTo: (activeId, targetId, placement) =>
        applyChange((d) => moveBlockTo(d, activeId, targetId, placement)),
      patch: (id, p) => applyChange((d) => updateBlock(d, id, p)),
      setProp: (id, name, v) => applyChange((d) => setBlockProp(d, id, name, v)),
      setSource: (id, source) => applyChange((d) => setBlockSource(d, id, source)),
      setParam: (id, name, v) => applyChange((d) => setBlockParam(d, id, name, v)),
      canAddTo: (parentId) => canAdd(draft, parentId),
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      undo,
      redo,
    };
  }, [
    draft,
    initial,
    selectedId,
    draggingId,
    past.length,
    future.length,
    applyChange,
    undo,
    redo,
  ]);

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

