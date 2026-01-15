"use client";

import { useState, useCallback, useEffect } from 'react';
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
import { GripVertical, Home } from 'lucide-react';
import type { Routes } from '@/lib/actions/access/route/types';
import { useUpdateRoute } from '@/lib/actions/access/route/queries';

interface SortableRoutesTableProps {
  routes: Routes[];
  t: (key: string) => string;
}

function SortableRow({ route, t, onToggleHome, onToggleShowSideBar, onToggleClientHome }: { route: Routes; t: (key: string) => string; onToggleHome: (id: string, isHome: boolean) => void; onToggleShowSideBar: (id: string, showSideBar: boolean) => void; onToggleClientHome: (id: string, isClientHome: boolean) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: route.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
      <TableCell className="w-10">
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="w-20">
        <Switch
          checked={route.isHome}
          onCheckedChange={(checked) => onToggleHome(route.id, checked)}
          aria-label="Definir como página inicial"
          disabled={route.isHome === true}
          className="data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-50"
        />
      </TableCell>
        <TableCell className="w-20">
        <Switch
          checked={route.isClientHome}
          onCheckedChange={(checked) => onToggleClientHome(route.id, checked)}
          aria-label="Definir como página inicial do cliente"
          disabled={route.isClientHome === true}
          className="data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-50"
        />
      </TableCell>
      <TableCell className="w-20">
        <Switch
          checked={route.showSideBar}
          onCheckedChange={(checked) => onToggleShowSideBar(route.id, checked)}
          aria-label="Definir como página inicial"
          disabled={route.isHome === true}
          className="data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-50"
        />
      </TableCell>
      <TableCell className="w-16">
        <span className="font-medium text-muted-foreground">{route.ordem}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono">
          {route.path}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{t(route.labelKey)}</span>
          {route.isHome && (
            <Badge variant="default" className="gap-1">
              <Home className="h-3 w-3" />
              Home
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={route.isActive ? 'default' : 'secondary'}>
          {route.isActive ? 'Ativa' : 'Inativa'}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export function SortableRoutesTable({ routes: initialRoutes, t }: SortableRoutesTableProps) {
  const [routes, setRoutes] = useState(initialRoutes);
  const updateRoute = useUpdateRoute();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRoutes((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Atualizar apenas as rotas que mudaram de posição
        const updates: Array<{ id: string; ordem: number }> = [];
        
        newItems.forEach((item, index) => {
          const newOrdem = index + 1;
          if (item.ordem !== newOrdem) {
            updates.push({ id: item.id, ordem: newOrdem });
          }
        });

        // Executar todas as atualizações
        if (updates.length > 0) {
          updates.forEach(({ id, ordem }) => {
            updateRoute.mutate({ id, data: { ordem } });
          });
        }

        return newItems;
      });
    }
  }, [updateRoute]);

  const handleToggleHome = useCallback((id: string, isHome: boolean) => {
    updateRoute.mutate({ id, data: { isHome } });
  }, [updateRoute]);

  const handleToggleShowSideBar = useCallback((id: string, showSideBar: boolean) => {
    updateRoute.mutate({ id, data: { showSideBar } });
  }, [updateRoute]);

  const handleToggleClientHome = useCallback((id: string, isClientHome: boolean) => {
    updateRoute.mutate({ id, data: { isClientHome } });
  }, [updateRoute]);

  // Atualizar rotas quando initialRoutes mudar
  useEffect(() => {
    setRoutes(initialRoutes);
  }, [initialRoutes]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="rounded-md border backdrop-blur-sm shadow-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-20">{'Home'}</TableHead>
              <TableHead className="w-20">{t('IsClientHome')}</TableHead>
              <TableHead className="w-20">{t('showSideBar') ?? 'Mostrar na Barra Lateral'}</TableHead>
              <TableHead className="w-16">{t('order') ?? 'Ordem'}</TableHead>
              <TableHead>{t('path') ?? 'Path'}</TableHead>
              <TableHead>{t('label') ?? 'Label'}</TableHead>
              <TableHead>{t('status') ?? 'Status'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext items={routes.map(r => r.id)} strategy={verticalListSortingStrategy}>
              {routes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t('noRoutes') ?? 'Nenhuma rota encontrada'}
                  </TableCell>
                </TableRow>
              ) : (
                routes.map((route) => (
                  <SortableRow
                    key={route.id}
                    route={route}
                    t={t}
                    onToggleHome={handleToggleHome}
                    onToggleShowSideBar={handleToggleShowSideBar}
                    onToggleClientHome={handleToggleClientHome} 
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
