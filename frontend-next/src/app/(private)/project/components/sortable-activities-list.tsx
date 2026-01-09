"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { Activity } from '@/lib/actions/project/types';
import { ActivityStatusColors } from '@/lib/actions/project/types';
import { useUpdateActivity, useDeleteActivity, useReorderActivities } from '@/lib/actions/project/queries';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/modal';
import { GenericCreateForm } from '@/components/generic-create-form';
import { set, z } from 'zod';
import type { FieldConfig } from '@/lib/form/field-config';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface SortableActivitiesListProps {
  activities: Activity[];
  stageId: string;
  isAdmin?: boolean;
}

function SortableActivityRow({ 
  activity,
  onEdit,
  onDelete,
  onStatusChange,
  isAdmin,
}: { 
  activity: Activity;
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onStatusChange: (activityId: string, status: string) => void;
  isAdmin?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex items-start justify-between border-l-2 pl-3 py-2 gap-2 ${isDragging ? 'z-50 bg-muted' : ''}`}
    >
      <div className="flex items-start gap-2 flex-1">
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none mt-0.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <p className="font-medium">{activity.title}</p>
          {activity.description && (
            <p className="text-sm text-muted-foreground">{activity.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin ? (
          <Select
            value={activity.status}
            onValueChange={(value) => onStatusChange(activity.id, value)}
          >
            <SelectTrigger className="w-[110px] h-8">
              <SelectValue>
                <Badge className={ActivityStatusColors[activity.status as keyof typeof ActivityStatusColors]}>
                  {activity.status}
                </Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODO">
                <Badge className={ActivityStatusColors.TODO}>TODO</Badge>
              </SelectItem>
              <SelectItem value="DOING">
                <Badge className={ActivityStatusColors.DOING}>DOING</Badge>
              </SelectItem>
              <SelectItem value="DONE">
                <Badge className={ActivityStatusColors.DONE}>DONE</Badge>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge className={ActivityStatusColors[activity.status as keyof typeof ActivityStatusColors]}>
            {activity.status}
          </Badge>
        )}
        {isAdmin && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(activity)}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(activity.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function SortableActivitiesList({ activities: initialActivities, stageId, isAdmin = false }: SortableActivitiesListProps) {
  const { t } = useTranslation('projects');
  const queryClient = useQueryClient();
  const [activities, setActivities] = useState(initialActivities);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  // Schema e config para editar Activity
  const updateActivitySchema = useMemo(() =>
    z.object({
      title: z.string().min(1, t('activityTitleRequired')),
      description: z.string().optional(),
      status: z.enum(['TODO', 'DOING', 'DONE']).optional(),
    }),
  [t]);

  const activityFieldConfig = useMemo(() => ({
    title: {
      label: t('activityTitle'),
      placeholder: t('activityTitlePlaceholder'),
    },
    description: {
      label: t('activityDescription'),
      placeholder: t('activityDescriptionPlaceholder'),
      type: 'textarea' as const,
    },
    status: {
      label: t('status'),
      type: 'select' as const,
      options: [
        { value: 'TODO', label: 'TODO' },
        { value: 'DOING', label: 'DOING' },
        { value: 'DONE', label: 'DONE' },
      ],
    },
  } satisfies FieldConfig<typeof updateActivitySchema>), [t]);

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
      setActivities((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Atualizar apenas as rotas que mudaram de posição
        const updates: Array<{ id: string; order: number }> = [];
        
        newItems.forEach((item, index) => {
          const newOrder = index + 1;
          if (item.order !== newOrder) {
            updates.push({ id: item.id, order: newOrder });
          }
        });

        // Executar todas as atualizações
        if (updates.length > 0) {
          updates.forEach(({ id, order }) => {
            updateActivity.mutateAsync({ id, data: { order } }).then(() => {
              queryClient.invalidateQueries({ 
                queryKey: ['activities', { 
                  filter: JSON.stringify({ stageId }), 
                  pagination: false 
                }] 
              });
            });
          });
        }

        return newItems;
      });
    }
  }, [updateActivity, stageId, queryClient]);


  const handleEdit = useCallback((activity: Activity) => {
    setEditingActivity(activity);
    setIsEditModalOpen(true);
  }, []);

  const handleDelete = useCallback((activityId: string) => {
    setDeletingActivityId(activityId);
    setIsDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingActivityId) return;
    
    try {
      await deleteActivity.mutateAsync(deletingActivityId);
      queryClient.invalidateQueries({ 
        queryKey: ['activities', { 
          filter: JSON.stringify({ stageId }), 
          pagination: false 
        }] 
      });
      toast.success(t('activityDeleted'));
      setIsDeleteModalOpen(false);
      setDeletingActivityId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error deleting activity');
    }
  }, [deletingActivityId, stageId, deleteActivity, queryClient, t]);

  const handleStatusChange = useCallback(async (activityId: string, status: string) => {
    try {
      await updateActivity.mutateAsync({
        id: activityId,
        data: { status: status as 'TODO' | 'DOING' | 'DONE' },
      });
      queryClient.invalidateQueries({ 
        queryKey: ['activities', { 
          filter: JSON.stringify({ stageId }), 
          pagination: false 
        }] 
      });
      toast.success(t('activityUpdated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating activity status');
    }
  }, [updateActivity, stageId, queryClient, t]);

  const handleUpdateSubmit = useCallback(async (data: z.infer<typeof updateActivitySchema>) => {
    if (!editingActivity) return;
    
    await updateActivity.mutateAsync({
      id: editingActivity.id,
      data,
    });
  }, [editingActivity, updateActivity]);

  const handleUpdateSuccess = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingActivity(null);
    queryClient.invalidateQueries({ 
      queryKey: ['activities', { 
        filter: JSON.stringify({ stageId }), 
        pagination: false 
      }] 
    });
    toast.success(t('activityUpdated'));
  }, [stageId, queryClient, t]);

  // Atualizar activities quando initialActivities mudar
  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={activities.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noActivities')}</p>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <SortableActivityRow
                  key={activity.id}
                  activity={activity}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      <Modal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        title={t('editActivity')}
        description={t('editActivityDescription')}
      >
        {editingActivity && (
          <GenericCreateForm
            schema={updateActivitySchema}
            fieldConfig={activityFieldConfig}
            onSubmit={handleUpdateSubmit}
            onSuccess={handleUpdateSuccess}
            submitLabel={t('save')}
            cancelLabel={t('cancel')}
            onCancel={() => setIsEditModalOpen(false)}
            defaultValues={{
              title: editingActivity.title,
              description: editingActivity.description || '',
              status: editingActivity.status,
            }}
          />
        )}
      </Modal>

      <Modal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title={t('deleteActivity')}
        description={t('deleteActivityConfirmation')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t('deleteActivityWarning')}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteActivity.isPending}
            >
              {deleteActivity.isPending ? t('deleting') : t('delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
