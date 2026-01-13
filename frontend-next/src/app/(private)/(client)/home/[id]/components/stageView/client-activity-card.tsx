'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { CommentModal } from '../comment-modal';
import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/actions/project/types';

interface ClientActivityCardProps {
  activity: Activity;
  projectId: string;
}

const statusConfig = {
  TODO: {
    label: 'To Do',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    borderColor: 'border-l-gray-400',
  },
  DOING: {
    label: 'Doing',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    borderColor: 'border-l-blue-500',
  },
  DONE: {
    label: 'Done',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    borderColor: 'border-l-green-500',
  },
};

export function ClientActivityCard({ activity, projectId }: ClientActivityCardProps) {
  const [showComments, setShowComments] = useState(false);

  const config = statusConfig[activity.status as keyof typeof statusConfig] || statusConfig.TODO;

  return (
    <>
      <Card
        className={cn(
          'border-l-4 hover:shadow-md transition-shadow',
          config.borderColor
        )}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm line-clamp-2">{activity.title}</h4>
            <Badge variant="secondary" className={cn('text-xs', config.color)}>
              {config.label}
            </Badge>
          </div>

          {activity.description && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {activity.description}
            </p>
          )}

          <div className="flex items-center justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowComments(true)}
              className="h-8 px-2"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <CommentModal
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        entityType="ACTIVITY"
        entityId={activity.id}
        projectId={projectId}
        entityName={activity.title}
      />
    </>
  );
}
