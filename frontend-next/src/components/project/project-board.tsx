'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  useProjectBoard,
  useDeleteMilestone,
  useReorderMilestones,
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useReorderTasks,
} from '@/lib/actions/project/queries';
import { MilestoneColumn } from './milestone-column';
import { TaskCard } from './task-card';
import { TaskListView } from './task-list-view';
import { TaskDetailSheet } from './task-detail-sheet';
import { CreateMilestoneDialog } from './create-milestone-dialog';
import { CreateTaskDialog } from './create-task-dialog';
import { ClientActionBanner } from './client-action-banner';
import { TASK_STATUS_CONFIG } from './milestone-progress';
import { UserAvatar } from './user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMe } from '@/lib/actions/auth/queries';
import { useUsers } from '@/lib/actions/user/queries';
import {
  LayoutGrid,
  ListTodo,
  Plus,
  Search,
  X,
  Filter,
  RotateCcw,
  User,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Milestone, MilestoneTask } from '@/lib/actions/project/types';
import type { UserDto } from '@/lib/generated/schemas';

interface ProjectBoardProps {
  projectId: string;
  canEdit?: boolean;
  mode?: 'admin' | 'client';
  onGoToRequests?: () => void;
}

function parseBoardItems(data: unknown): Milestone[] {
  const raw = Array.isArray(data)
    ? (data as Milestone[])
    : Array.isArray((data as { data?: Milestone[] })?.data)
    ? (data as { data: Milestone[] }).data
    : [];

  return raw.map((m) => ({
    ...m,
    tasks: Array.isArray(m.tasks) ? m.tasks : [],
  }));
}

export function ProjectBoard({
  projectId,
  canEdit = true,
  mode = 'admin',
  onGoToRequests,
}: ProjectBoardProps) {
  const { data: boardData, isLoading } = useProjectBoard(projectId);
  const deleteMilestoneMutation = useDeleteMilestone(projectId);
  const reorderMilestonesMutation = useReorderMilestones(projectId);
  const createTaskMutation = useCreateTask(projectId);
  const deleteTaskMutation = useDeleteTask(projectId);
  const moveTaskMutation = useMoveTask(projectId);
  const reorderTasksMutation = useReorderTasks(projectId);

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [isCreateMilestoneOpen, setIsCreateMilestoneOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createTaskMilestoneId, setCreateTaskMilestoneId] = useState<string | undefined>(undefined);
  const [createTaskMilestoneTitle, setCreateTaskMilestoneTitle] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<MilestoneTask | null>(null);
  const [selectedMilestoneTitle, setSelectedMilestoneTitle] = useState<string>('');
  const [activeTask, setActiveTask] = useState<MilestoneTask | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);

  const handleOpenCreateTask = (milestoneId?: string, milestoneTitle?: string) => {
    setCreateTaskMilestoneId(milestoneId);
    setCreateTaskMilestoneTitle(milestoneTitle);
    setIsCreateTaskOpen(true);
  };

  // Estado local para permitir drag and drop otimista e fluido sem efeito rebote
  const [items, setItems] = useState<Milestone[]>(() => parseBoardItems(boardData));
  const [prevBoardData, setPrevBoardData] = useState(boardData);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: meData } = useMe();
  const { data: usersData } = useUsers();

  const users = useMemo(() => {
    if (!usersData) return [];
    const raw = Array.isArray(usersData)
      ? (usersData as UserDto[])
      : (usersData as { data?: UserDto[] })?.data ??
        (usersData as { items?: UserDto[] })?.items ??
        [];
    return raw;
  }, [usersData]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  const isFilterActive = useMemo(() => {
    return (
      Boolean(searchQuery.trim()) ||
      statusFilter !== 'all' ||
      assigneeFilter !== 'all' ||
      onlyMyTasks
    );
  }, [searchQuery, statusFilter, assigneeFilter, onlyMyTasks]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== 'all') count++;
    if (assigneeFilter !== 'all') count++;
    if (onlyMyTasks) count++;
    return count;
  }, [searchQuery, statusFilter, assigneeFilter, onlyMyTasks]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setAssigneeFilter('all');
    setOnlyMyTasks(false);
  };

  if (boardData !== prevBoardData) {
    setPrevBoardData(boardData);
    setItems(parseBoardItems(boardData));
  }

  const displayedItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.map((m) => {
      const allTasks = m.tasks ?? [];

      const filteredTasks = allTasks.filter((t) => {
        // 1. Filtro textual
        if (query) {
          const matchTitle = t.title.toLowerCase().includes(query);
          const matchDesc = t.description?.toLowerCase().includes(query);
          const matchAssignee =
            t.assignee?.name?.toLowerCase().includes(query) ||
            t.assignee?.email?.toLowerCase().includes(query);
          const matchBlocked = t.blockedReason?.toLowerCase().includes(query);
          const matchMilestoneTitle = m.title.toLowerCase().includes(query);
          if (!matchTitle && !matchDesc && !matchAssignee && !matchBlocked && !matchMilestoneTitle) {
            return false;
          }
        }

        // 2. Filtro de Status
        if (statusFilter !== 'all') {
          const taskStatus = t.status || 'WAITING';
          if (taskStatus !== statusFilter) {
            return false;
          }
        }

        // 3. Filtro de Responsável
        if (assigneeFilter !== 'all') {
          if (assigneeFilter === '__UNASSIGNED__') {
            if (t.assigneeId || t.assignee) return false;
          } else {
            const taskAssigneeId = t.assigneeId ?? t.assignee?.id;
            if (taskAssigneeId !== assigneeFilter) return false;
          }
        }

        // 4. Filtro "Minhas Tarefas"
        if (onlyMyTasks) {
          const taskAssigneeId = t.assigneeId ?? t.assignee?.id;
          if (!meData?.id || taskAssigneeId !== meData.id) {
            return false;
          }
        }

        return true;
      });

      return {
        ...m,
        allTasks,
        tasks: filteredTasks,
      };
    });
  }, [items, searchQuery, statusFilter, assigneeFilter, onlyMyTasks, meData?.id]);

  const totalTasks = useMemo(() => {
    return items.reduce((acc, m) => acc + (m.tasks?.length ?? 0), 0);
  }, [items]);

  const filteredTasksCount = useMemo(() => {
    return displayedItems.reduce((acc, m) => acc + (m.tasks?.length ?? 0), 0);
  }, [displayedItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // evita acionar drag em cliques normais
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      await deleteMilestoneMutation.mutateAsync(milestoneId);
      toast.success('Etapa removida');
    } catch {
      toast.error('Erro ao remover etapa');
    }
  };

  const handleAddTask = async (milestoneId: string, title: string) => {
    try {
      await createTaskMutation.mutateAsync({
        milestoneId,
        data: { title },
      });
      toast.success('Tarefa criada');
    } catch {
      toast.error('Erro ao criar tarefa');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTaskMutation.mutateAsync(taskId);
      toast.success('Tarefa removida');
    } catch {
      toast.error('Erro ao remover tarefa');
    }
  };

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const activeType = args.active.data.current?.type;

    if (activeType === 'COLUMN') {
      const otherColumns = args.droppableContainers.filter(
        (c) => c.data.current?.type === 'COLUMN' && c.id !== args.active.id
      );

      const pointerCollisions = pointerWithin({
        ...args,
        droppableContainers: otherColumns,
      });
      if (pointerCollisions.length > 0) {
        return pointerCollisions;
      }

      const rectCollisions = rectIntersection({
        ...args,
        droppableContainers: otherColumns,
      });
      if (rectCollisions.length > 0) {
        return rectCollisions;
      }

      return closestCenter({
        ...args,
        droppableContainers: otherColumns,
      });
    }

    // Para tarefas: desconsiderar o próprio container ativo para evitar auto-colisão
    const otherContainers = args.droppableContainers.filter(
      (c) => c.id !== args.active.id
    );

    const pointerCollisions = pointerWithin({
      ...args,
      droppableContainers: otherContainers,
    });
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    const rectCollisions = rectIntersection({
      ...args,
      droppableContainers: otherContainers,
    });
    if (rectCollisions.length > 0) {
      return rectCollisions;
    }

    return closestCenter({
      ...args,
      droppableContainers: otherContainers,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.type === 'TASK') {
      setActiveTask(data.task);
      setActiveMilestone(null);
    } else if (data?.type === 'COLUMN') {
      setActiveMilestone(data.milestone);
      setActiveTask(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveMilestone(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // 1. Reordenação de colunas (Milestones)
    if (activeType === 'COLUMN') {
      let targetColumnId: string | null = null;

      if (overType === 'COLUMN') {
        targetColumnId = over.id as string;
      } else {
        // Se soltou sobre uma task ou elemento filho da coluna, localiza a coluna correspondente
        const found = items.find(
          (m) => m.id === over.id || m.tasks.some((t) => t.id === over.id)
        );
        if (found) {
          targetColumnId = found.id;
        }
      }

      if (targetColumnId && active.id !== targetColumnId) {
        const oldIndex = items.findIndex((m) => m.id === active.id);
        const newIndex = items.findIndex((m) => m.id === targetColumnId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(items, oldIndex, newIndex);
          // Atualização Otimista Imediata no front
          setItems(reordered);

          try {
            await reorderMilestonesMutation.mutateAsync(reordered.map((m) => m.id));
          } catch {
            setItems(items); // Rollback em caso de falha
            toast.error('Erro ao reordenar etapas');
          }
        }
      }
      return;
    }

    // 2. Movimentação / Reordenação de Tarefas
    if (activeType === 'TASK') {
      const activeTaskId = active.id as string;
      const sourceMilestone = items.find((m) =>
        m.tasks.some((t) => t.id === activeTaskId)
      );

      if (!sourceMilestone) return;

      // Destino pode ser uma Coluna ou outra Tarefa
      let targetMilestoneId: string | null = null;
      let targetIndex = 0;

      if (overType === 'COLUMN') {
        targetMilestoneId = over.id as string;
        const targetMilestone = items.find((m) => m.id === targetMilestoneId);
        targetIndex = targetMilestone ? targetMilestone.tasks.length : 0;
      } else {
        const targetMilestone = items.find(
          (m) => m.id === over.id || m.tasks.some((t) => t.id === over.id)
        );
        if (targetMilestone) {
          targetMilestoneId = targetMilestone.id;
          const overIndex = targetMilestone.tasks.findIndex((t) => t.id === over.id);
          targetIndex = overIndex >= 0 ? overIndex : targetMilestone.tasks.length;
        }
      }

      if (!targetMilestoneId) return;

      // Mesma coluna: reordenação
      if (sourceMilestone.id === targetMilestoneId) {
        const oldIndex = sourceMilestone.tasks.findIndex((t) => t.id === activeTaskId);
        if (oldIndex !== targetIndex && oldIndex !== -1) {
          const reorderedTasks = arrayMove(sourceMilestone.tasks, oldIndex, targetIndex);
          const newItems = items.map((m) =>
            m.id === sourceMilestone.id ? { ...m, tasks: reorderedTasks } : m
          );
          setItems(newItems);

          try {
            await reorderTasksMutation.mutateAsync({
              milestoneId: sourceMilestone.id,
              orderedIds: reorderedTasks.map((t) => t.id),
            });
          } catch {
            setItems(items);
            toast.error('Erro ao reordenar tarefas');
          }
        }
      } else {
        // Coluna diferente: mover tarefa
        const targetMilestone = items.find((m) => m.id === targetMilestoneId);
        if (!targetMilestone) return;

        const movingTask = sourceMilestone.tasks.find((t) => t.id === activeTaskId);
        if (!movingTask) return;

        const newSourceTasks = sourceMilestone.tasks.filter((t) => t.id !== activeTaskId);
        const newTargetTasks = [...targetMilestone.tasks];
        newTargetTasks.splice(targetIndex, 0, movingTask);

        const newItems = items.map((m) => {
          if (m.id === sourceMilestone.id) return { ...m, tasks: newSourceTasks };
          if (m.id === targetMilestoneId) return { ...m, tasks: newTargetTasks };
          return m;
        });
        setItems(newItems);

        try {
          await moveTaskMutation.mutateAsync({
            taskId: activeTaskId,
            data: {
              milestoneId: targetMilestoneId,
              position: targetIndex,
            },
          });
        } catch {
          setItems(items);
          toast.error('Erro ao mover tarefa');
        }
      }
    }
  };

  const milestoneIds = displayedItems.map((m) => m.id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[300px]">
              <Skeleton className="h-[460px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner de Pendências que precisam da ação do cliente */}
      <ClientActionBanner
        projectId={projectId}
        mode={mode}
        onGoToRequests={onGoToRequests}
      />

      {/* Barra de Controles: Alternador de Visualização + Busca + Nova Etapa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border w-fit">
            <Button
              variant={viewMode === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-medium px-2.5"
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
              Quadro (Kanban)
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-medium px-2.5"
              onClick={() => setViewMode('list')}
            >
              <ListTodo className="mr-1.5 h-3.5 w-3.5" />
              Lista de Etapas
            </Button>
          </div>

          {/* Campo de Busca Rápida de Tarefas */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8 pr-7 w-40 sm:w-56 bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isFilterActive && (
            <Badge variant="outline" className="text-[11px] h-7 px-2 border-primary/30 text-primary">
              {filteredTasksCount} de {totalTasks} tarefas
            </Badge>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenCreateTask()}
              className="h-8 text-xs px-3 gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Tarefa
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateMilestoneOpen(true)}
              className="h-8 text-xs px-3"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Nova Etapa
            </Button>
          </div>
        )}
      </div>

      {/* Barra de Filtros: Status, Responsável, Minhas Tarefas, Bloqueadas */}
      <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg bg-muted/20 border border-border/60 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium mr-1">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span>Filtros:</span>
        </div>

        {/* Filtro de Status */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 text-xs w-[145px] bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="text-xs">
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(TASK_STATUS_CONFIG).map(([stKey, conf]) => {
              const Icon = conf.icon;
              return (
                <SelectItem key={stKey} value={stKey} className="text-xs">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{conf.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Filtro de Responsável */}
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-7 text-xs w-[165px] bg-background">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent className="text-xs max-h-60">
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            <SelectItem value="__UNASSIGNED__">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <UserX className="h-3.5 w-3.5" />
                <span>Sem responsável</span>
              </div>
            </SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={u.name}
                    email={u.email}
                    imageUrl={u.imageUrl}
                    className="h-4 w-4 text-[8px]"
                  />
                  <span className="truncate max-w-[120px]">{u.name || u.email}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle Chip: Minhas Tarefas */}
        {meData?.id && (
          <Button
            type="button"
            variant={onlyMyTasks ? 'secondary' : 'outline'}
            size="sm"
            className={`h-7 text-xs gap-1.5 transition-colors cursor-pointer ${
              onlyMyTasks
                ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                : 'text-muted-foreground'
            }`}
            onClick={() => setOnlyMyTasks((prev) => !prev)}
            title="Mostrar apenas tarefas atribuídas a mim"
          >
            <User className="h-3 w-3" />
            Minhas tarefas
          </Button>
        )}

        {/* Botão Limpar Filtros quando ativo com destaque visual */}
        {isFilterActive && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={`h-7 text-xs gap-1.5 px-2.5 font-medium cursor-pointer border transition-all ${
              filteredTasksCount === 0
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25 font-semibold shadow-xs'
                : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
            }`}
            onClick={handleResetFilters}
            title="Limpar todos os filtros e busca"
          >
            <RotateCcw className="h-3 w-3" />
            <span>
              {filteredTasksCount === 0 ? 'Limpar filtros (nenhuma tarefa)' : `Limpar filtros (${activeFiltersCount})`}
            </span>
          </Button>
        )}

        {/* Contador de tarefas filtradas */}
        <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
          {filteredTasksCount} de {totalTasks} {totalTasks === 1 ? 'tarefa' : 'tarefas'}
        </span>
      </div>

      {/* Conteúdo: Modo Quadro (Kanban) ou Modo Lista */}
      {viewMode === 'list' ? (
        <TaskListView
          projectId={projectId}
          milestones={displayedItems}
          canEdit={canEdit && !isFilterActive}
          onSelectTask={(task, title) => {
            setSelectedTask(task);
            setSelectedMilestoneTitle(title);
          }}
          onOpenCreateTask={canEdit ? handleOpenCreateTask : undefined}
          onAddTask={canEdit ? handleAddTask : undefined}
          onDeleteTask={canEdit ? handleDeleteTask : undefined}
          onDeleteMilestone={canEdit ? handleDeleteMilestone : undefined}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[480px]">
            <SortableContext items={milestoneIds} strategy={horizontalListSortingStrategy}>
              {displayedItems.map((milestone) => (
                <MilestoneColumn
                  key={milestone.id}
                  projectId={projectId}
                  milestone={milestone}
                  canEdit={canEdit && !isFilterActive}
                  onSelectTask={(task, title) => {
                    setSelectedTask(task);
                    setSelectedMilestoneTitle(title);
                  }}
                  onOpenCreateTask={canEdit ? handleOpenCreateTask : undefined}
                  onAddTask={canEdit ? handleAddTask : undefined}
                  onDeleteTask={canEdit ? handleDeleteTask : undefined}
                  onDeleteMilestone={canEdit ? handleDeleteMilestone : undefined}
                />
              ))}
            </SortableContext>

            {canEdit && (
              <button
                type="button"
                onClick={() => setIsCreateMilestoneOpen(true)}
                className="w-[280px] h-32 flex-shrink-0 border-2 border-dashed rounded-xl bg-muted/10 hover:bg-muted/20 hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-xs">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold">+ Adicionar outra etapa</span>
              </button>
            )}
          </div>

          <DragOverlay>
            {activeMilestone && (
              <div className="w-[300px] shadow-2xl rounded-xl overflow-hidden pointer-events-none opacity-90 rotate-1 border-2 border-primary/40">
                <MilestoneColumn
                  projectId={projectId}
                  milestone={activeMilestone}
                  canEdit={false}
                  onSelectTask={() => {}}
                />
              </div>
            )}
            {activeTask && (
              <div className="w-[280px] shadow-lg rounded-xl overflow-hidden pointer-events-none rotate-2">
                <TaskCard
                  task={activeTask}
                  canEdit={false}
                  onSelect={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Drawer Lateral de Detalhes da Tarefa com Rich Text e Comentários */}
      <TaskDetailSheet
        projectId={projectId}
        task={selectedTask}
        milestoneTitle={selectedMilestoneTitle}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        canEdit={canEdit}
      />

      {/* Modal para Criar Nova Etapa com Rich Text de Descrição */}
      <CreateMilestoneDialog
        projectId={projectId}
        open={isCreateMilestoneOpen}
        onOpenChange={setIsCreateMilestoneOpen}
      />

      {/* Modal para Criar Nova Tarefa com Status, Motivo de Bloqueio e Rich Text */}
      <CreateTaskDialog
        projectId={projectId}
        milestoneId={createTaskMilestoneId}
        milestoneTitle={createTaskMilestoneTitle}
        availableMilestones={items.map((m) => ({ id: m.id, title: m.title }))}
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
      />
    </div>
  );
}

