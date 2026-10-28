"use client";

import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Routes } from '@/lib/actions/access/route/types';
import { useUpdateRoute } from '@/lib/actions/access/route/queries';
import type { TFunc } from '@/hooks/use-translation';
import { buildRouteRows, reorderSiblings, type RouteRow } from './routes-tree';

interface SortableRoutesTableProps {
  routes: Routes[];
  t: TFunc;
}

function CollapseButton({
  collapsed,
  onClick,
  ariaLabel,
  className,
}: {
  collapsed: boolean;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn('hover:bg-muted shrink-0 rounded p-0.5', className)}
    >
      {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
    </button>
  );
}

function SortableRow({
  row,
  t,
  collapsed,
  onToggleCollapsed,
  onToggleShowSideBar,
}: {
  row: RouteRow;
  t: (key: string) => string;
  collapsed: boolean;
  onToggleCollapsed: (id: string) => void;
  onToggleShowSideBar: (id: string, showSideBar: boolean) => void;
}) {
  const { route, depth, hasChildren } = row;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: route.id });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={isDragging ? 'z-50' : ''}
    >
      <TableCell className="w-8 sm:w-12 px-2 sm:px-4">
        <button
          className="hover:bg-muted cursor-grab touch-none rounded p-1.5 sm:p-2 size-7 sm:size-9 flex items-center justify-center active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="text-muted-foreground h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="w-14 sm:w-20 px-2 sm:px-4">
        <Switch
          checked={route.showSideBar}
          onCheckedChange={(checked) => onToggleShowSideBar(route.id, checked)}
          aria-label={t('ariaSetSideBar')}
          className="data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-50"
        />
      </TableCell>
      <TableCell className="w-16 hidden md:table-cell">
        <span className="text-muted-foreground font-medium">{route.ordem}</span>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
          {hasChildren ? (
            <CollapseButton
              collapsed={collapsed}
              onClick={() => onToggleCollapsed(route.id)}
              ariaLabel={collapsed ? t('expand') : t('collapse')}
            />
          ) : (
            <span className="inline-block size-3.5 shrink-0" />
          )}
          <Badge variant="outline" className="font-mono">{route.path}</Badge>
        </div>
      </TableCell>
      <TableCell className="px-2 sm:px-4">
        <div className="flex flex-col gap-0.5" style={{ paddingLeft: depth * 14 }}>
          <div className="flex items-center gap-1">
            {hasChildren && (
              <CollapseButton
                collapsed={collapsed}
                onClick={() => onToggleCollapsed(route.id)}
                ariaLabel={collapsed ? t('expand') : t('collapse')}
                className="md:hidden"
              />
            )}
            <span className="font-medium text-foreground text-sm">{t(route.labelKey)}</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono md:hidden">
            {route.path}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant={route.isActive ? 'default' : 'secondary'}>
          {route.isActive ? t('routeActive') : t('routeInactive')}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export function SortableRoutesTable({ routes: initialRoutes, t }: SortableRoutesTableProps) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [prevInitialRoutes, setPrevInitialRoutes] = useState(initialRoutes);
  // Sincroniza `routes` quando `initialRoutes` mudar — ajuste de estado durante o render
  // (não em effect) evita o commit extra: https://react.dev/learn/you-might-not-need-an-effect
  if (initialRoutes !== prevInitialRoutes) {
    setPrevInitialRoutes(initialRoutes);
    setRoutes(initialRoutes);
  }
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const updateRoute = useUpdateRoute();

  const rows = useMemo(() => buildRouteRows(routes, collapsed), [routes, collapsed]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleReorder = useCallback(
    (dragId: string, overId: string) => {
      if (dragId === overId) return;
      const dragged = routes.find((r) => r.id === dragId);
      const target = routes.find((r) => r.id === overId);
      if (!dragged || !target || (dragged.parentId ?? null) !== (target.parentId ?? null)) return;

      const visible = rows.map((r) => r.route.id);
      const moved = arrayMove(visible, visible.indexOf(dragId), visible.indexOf(overId));
      const updates = reorderSiblings(routes, dragged.parentId ?? null, moved);
      updates.forEach(({ id, ordem }) => updateRoute.mutate({ id, data: { ordem } }));
      setRoutes((items) =>
        items.map((item) => {
          const update = updates.find((u) => u.id === item.id);
          return update ? { ...item, ordem: update.ordem } : item;
        }),
      );
    },
    [routes, rows, updateRoute],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      handleReorder(String(active.id), String(over.id));
    },
    [handleReorder],
  );

  const handleToggleShowSideBar = useCallback(
    (id: string, showSideBar: boolean) => updateRoute.mutate({ id, data: { showSideBar } }),
    [updateRoute],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="rounded-md border overflow-x-auto">
        <Table className="w-full md:min-w-[620px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 sm:w-10 px-2 sm:px-4" />
              <TableHead className="w-14 sm:w-20 px-2 sm:px-4">{t('showSideBar')}</TableHead>
              <TableHead className="w-16 hidden md:table-cell">{t('order')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('path')}</TableHead>
              <TableHead className="px-2 sm:px-4">{t('label')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext items={rows.map((r) => r.route.id)} strategy={verticalListSortingStrategy}>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    {t('noRoutes')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <SortableRow
                    key={row.route.id}
                    row={row}
                    t={t}
                    collapsed={collapsed.has(row.route.id)}
                    onToggleCollapsed={toggleCollapsed}
                    onToggleShowSideBar={handleToggleShowSideBar}
                  />
                ))
              )}
            </SortableContext>
          </TableBody>
        </Table>
      </div>
    </DndContext>
  );
}
