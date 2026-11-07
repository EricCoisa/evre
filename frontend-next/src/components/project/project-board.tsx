'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { useTranslation } from '@/hooks/use-translation';
import {
  LayoutGrid,
  ListTodo,
  Plus,
  Search,
  X,
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
  initialTaskId?: string;
}

function findTaskById(
  items: Milestone[],
  taskId: string
): { task: MilestoneTask; milestoneTitle: string } | null {
  for (const m of items) {
    const found = m.tasks?.find((t) => t.id === taskId);
    if (found) {
      return { task: found, milestoneTitle: m.title };
    }
  }
  return null;
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

interface TaskFilterParams {
  query: string;
  statusFilter: string;
  assigneeFilter: string;
  onlyMyTasks: boolean;
  currentUserId?: string;
  milestoneTitle: string;
}

function matchesSearchQuery(task: MilestoneTask, query: string, milestoneTitle: string): boolean {
  if (!query) return true;
  const searchableStrings = [
    task.title,
    task.description,
    task.assignee?.name,
    task.assignee?.email,
    task.blockedReason,
    milestoneTitle,
  ];
  return searchableStrings.some((str) => str?.toLowerCase().includes(query));
}

function matchesStatus(task: MilestoneTask, statusFilter: string): boolean {
  if (statusFilter === 'all') return true;
  const taskStatus = task.status || 'WAITING';
  return taskStatus === statusFilter;
}

function matchesAssignee(task: MilestoneTask, assigneeFilter: string): boolean {
  if (assigneeFilter === 'all') return true;
  if (assigneeFilter === '__UNASSIGNED__') {
    return !task.assigneeId && !task.assignee;
  }
  const taskAssigneeId = task.assigneeId ?? task.assignee?.id;
  return taskAssigneeId === assigneeFilter;
}

function matchesMyTasks(task: MilestoneTask, onlyMyTasks: boolean, currentUserId?: string): boolean {
  if (!onlyMyTasks) return true;
  if (!currentUserId) return false;
  const taskAssigneeId = task.assigneeId ?? task.assignee?.id;
  return taskAssigneeId === currentUserId;
}

function filterMilestoneTasks(
  tasks: MilestoneTask[],
  params: TaskFilterParams
): MilestoneTask[] {
  return tasks.filter((t) =>
    matchesSearchQuery(t, params.query, params.milestoneTitle) &&
    matchesStatus(t, params.statusFilter) &&
    matchesAssignee(t, params.assigneeFilter) &&
    matchesMyTasks(t, params.onlyMyTasks, params.currentUserId)
  );
}

export function ProjectBoard({
  projectId,
  canEdit = true,
  mode = 'admin',
  onGoToRequests,
  initialTaskId,
}: ProjectBoardProps) {
  const { t } = useTranslation('project');
  const searchParams = useSearchParams();
  const searchParamTaskId = searchParams.get('task') || searchParams.get('taskId');
  const targetTaskId = initialTaskId || searchParamTaskId;

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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => targetTaskId ?? null);
  const [prevTargetTaskId, setPrevTargetTaskId] = useState(targetTaskId);
  if (targetTaskId !== prevTargetTaskId) {
    setPrevTargetTaskId(targetTaskId);
    setSelectedTaskId(targetTaskId ?? null);
  }

  const [activeTask, setActiveTask] = useState<MilestoneTask | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);

  const handleOpenCreateTask = (milestoneId?: string, milestoneTitle?: string) => {
    setCreateTaskMilestoneId(milestoneId);
    setCreateTaskMilestoneTitle(milestoneTitle);
    setIsCreateTaskOpen(true);
  };

  const handleSelectTask = (task: MilestoneTask) => {
    setSelectedTaskId(task.id);

    if (typeof window !== 'undefined') {
      const basePath = `/project/${projectId}/${task.id}`;
      const search = window.location.search;
      const newUrl = search ? `${basePath}${search}` : basePath;
      if (window.location.pathname !== basePath) {
        window.history.pushState({ taskId: task.id }, '', newUrl);
      }
    }
  };

  const handleCloseTask = () => {
    setSelectedTaskId(null);

    if (typeof window !== 'undefined') {
      const basePath = `/project/${projectId}`;
      const search = window.location.search;
      const newUrl = search ? `${basePath}${search}` : basePath;
      if (window.location.pathname !== basePath) {
        window.history.pushState({ taskId: null }, '', newUrl);
      }
    }
  };

  // Estado local para permitir drag and drop otimista e fluido sem efeito rebote
  const [items, setItems] = useState<Milestone[]>(() => parseBoardItems(boardData));
  const [prevBoardData, setPrevBoardData] = useState(boardData);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedTaskMatch = useMemo(() => {
    if (!selectedTaskId) return null;
    return findTaskById(items, selectedTaskId);
  }, [items, selectedTaskId]);

  const selectedTask = selectedTaskMatch?.task ?? null;
  const selectedMilestoneTitle = selectedTaskMatch?.milestoneTitle ?? '';

  const checkedInitialTaskRef = useRef<string | null>(null);

  useEffect(() => {
    if (!targetTaskId || isLoading || items.length === 0) return;
    if (checkedInitialTaskRef.current === targetTaskId) return;

    checkedInitialTaskRef.current = targetTaskId;
    const match = findTaskById(items, targetTaskId);
    if (!match) {
      toast.error(t('boardTaskNotFoundToast'));
    }
  }, [targetTaskId, isLoading, items, t]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const pathname = window.location.pathname;
      const segments = pathname.split('/').filter(Boolean);
      const isTaskUrl = segments.length >= 3 && (segments[0] === 'project' || segments[0] === 'my-project');
      const pathTaskId = isTaskUrl ? segments[2] : null;

      setSelectedTaskId(pathTaskId ?? null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const { data: meData } = useMe();
  const currentUserId = meData?.id;
  const isClient = mode === 'client' || meData?.role === 'USER' || (meData as { roleName?: string })?.roleName === 'USER';
  const { data: usersData } = useUsers(undefined, { enabled: !isClient });

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
      (!isClient && (assigneeFilter !== 'all' || onlyMyTasks))
    );
  }, [searchQuery, statusFilter, assigneeFilter, onlyMyTasks, isClient]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== 'all') count++;
    if (!isClient && assigneeFilter !== 'all') count++;
    if (!isClient && onlyMyTasks) count++;
    return count;
  }, [searchQuery, statusFilter, assigneeFilter, onlyMyTasks, isClient]);

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

  const effectiveAssigneeFilter = isClient ? 'all' : assigneeFilter;
  const effectiveOnlyMyTasks = isClient ? false : onlyMyTasks;

  const displayedItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.map((m) => {
      const allTasks = m.tasks ?? [];
      const tasks = filterMilestoneTasks(allTasks, {
        query,
        statusFilter,
        assigneeFilter: effectiveAssigneeFilter,
        onlyMyTasks: effectiveOnlyMyTasks,
        currentUserId,
        milestoneTitle: m.title,
      });

      return {
        ...m,
        allTasks,
        tasks,
      };
    });
  }, [items, searchQuery, statusFilter, effectiveAssigneeFilter, effectiveOnlyMyTasks, currentUserId]);

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
      toast.success(t('boardMilestoneDeletedToast'));
    } catch {
      toast.error(t('boardMilestoneDeleteErrorToast'));
    }
  };

  const handleAddTask = async (milestoneId: string, title: string) => {
    try {
      await createTaskMutation.mutateAsync({
        milestoneId,
        data: { title },
      });
      toast.success(t('boardTaskCreatedToast'));
    } catch {
      toast.error(t('boardTaskCreateErrorToast'));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTaskMutation.mutateAsync(taskId);
      toast.success(t('boardTaskDeletedToast'));
    } catch {
      toast.error(t('boardTaskDeleteErrorToast'));
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
            toast.error(t('boardReorderMilestonesErrorToast'));
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
            toast.error(t('boardReorderTasksErrorToast'));
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
          toast.error(t('boardMoveTaskErrorToast'));
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

      {/* Barra Unificada de Controles, Busca, Filtros e Ações */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 p-2 rounded-xl bg-card border shadow-xs">
        {/* Lado Esquerdo: Modo de Exibição, Busca e Controles de Filtros */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Alternador de Visualização */}
          <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-lg border w-fit flex-shrink-0">
            <Button
              variant={viewMode === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-medium px-2.5"
              onClick={() => setViewMode('board')}
              title={t('boardKanbanTooltip')}
            >
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
              {t('boardKanban')}
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-medium px-2.5"
              onClick={() => setViewMode('list')}
              title={t('boardListTooltip')}
            >
              <ListTodo className="mr-1.5 h-3.5 w-3.5" />
              {t('boardList')}
            </Button>
          </div>

          <div className="h-5 w-px bg-border/60 hidden sm:block flex-shrink-0" />

          {/* Campo de Busca Rápida de Tarefas */}
          <div className="relative min-w-[150px] sm:min-w-[190px] flex-shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('boardSearchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8 pr-7 bg-background w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title={t('boardClearSearch')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-[135px] sm:w-[145px] bg-background flex-shrink-0">
              <SelectValue placeholder={t('boardStatus')} />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="all">{t('boardAllStatuses')}</SelectItem>
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

          {!isClient && (
            <>
              {/* Filtro de Responsável */}
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-8 text-xs w-[145px] sm:w-[160px] bg-background flex-shrink-0">
                  <SelectValue placeholder={t('boardAssignee')} />
                </SelectTrigger>
                <SelectContent className="text-xs max-h-60">
                  <SelectItem value="all">{t('boardAllAssignees')}</SelectItem>
                  <SelectItem value="__UNASSIGNED__">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <UserX className="h-3.5 w-3.5" />
                      <span>{t('boardUnassigned')}</span>
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
                  className={`h-8 text-xs gap-1.5 px-2.5 transition-colors cursor-pointer flex-shrink-0 ${
                    onlyMyTasks
                      ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                      : 'text-muted-foreground'
                  }`}
                  onClick={() => setOnlyMyTasks((prev) => !prev)}
                  title={t('boardMyTasksTooltip')}
                >
                  <User className="h-3 w-3" />
                  {t('boardMyTasks')}
                </Button>
              )}
            </>
          )}

          {/* Botão Limpar Filtros quando ativo com destaque visual */}
          {isFilterActive && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={`h-8 text-xs gap-1.5 px-2.5 font-medium cursor-pointer border transition-all flex-shrink-0 ${
                filteredTasksCount === 0
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25 font-semibold shadow-xs'
                  : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
              }`}
              onClick={handleResetFilters}
              title={t('boardClearFiltersTooltip')}
            >
              <RotateCcw className="h-3 w-3" />
              <span>
                {filteredTasksCount === 0
                  ? t('boardClearFiltersZero')
                  : t('boardClearFiltersCount', { count: activeFiltersCount })}
              </span>
            </Button>
          )}

          {/* Contador de tarefas filtradas */}
          {isFilterActive && (
            <Badge variant="outline" className="text-[11px] h-7 px-2 border-primary/30 text-primary hidden 2xl:inline-flex flex-shrink-0">
              {t('boardTasksCountFiltered', { count: filteredTasksCount, total: totalTasks })}
            </Badge>
          )}
        </div>

        {/* Lado Direito: Ações de Criação (Nova Tarefa, Nova Etapa) */}
        {canEdit && (
          <div className="flex items-center gap-2 flex-shrink-0 self-end xl:self-center pt-2 xl:pt-0 border-t xl:border-t-0 border-border/40 w-full xl:w-auto justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenCreateTask()}
              className="h-8 text-xs px-3 gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('boardNewTask')}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateMilestoneOpen(true)}
              className="h-8 text-xs px-3"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('boardNewMilestone')}
            </Button>
          </div>
        )}
      </div>

      {/* Conteúdo: Modo Quadro (Kanban) ou Modo Lista */}
      {viewMode === 'list' ? (
        <TaskListView
          projectId={projectId}
          milestones={displayedItems}
          canEdit={canEdit && !isFilterActive}
          onSelectTask={(task) => handleSelectTask(task)}
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
                  onSelectTask={(task) => handleSelectTask(task)}
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
                <span className="text-xs font-semibold">{t('boardAddAnotherMilestone')}</span>
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
        onOpenChange={(open) => !open && handleCloseTask()}
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

