'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCommentsByEntity, useCreateComment } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { Loader2, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

import type {
  CreateCommentDto,
  CommentEntityType,
} from '@/lib/actions/project/types';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  projectId: string;
  entityName: string;
}

export function CommentModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  projectId,
  entityName,
}: CommentModalProps) {
  const { t, locale: currentLocale } = useTranslation('projects');
  const [content, setContent] = useState('');

  const { data: comments, isLoading } = useCommentsByEntity(entityType, entityId);
  const createCommentMutation = useCreateComment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast.error(t('commentRequired'));
      return;
    }

    try {
      await createCommentMutation.mutateAsync({
        content: content.trim(),
        entityType: entityType as CommentEntityType,
        entityId,
        projectId,
      });
      
      setContent('');
      toast.success(t('commentCreated'));
    } catch {
      toast.error(t('commentError'));
    }
  };

  const locale = currentLocale === 'pt-BR' ? ptBR : enUS;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t('comments')}
          </DialogTitle>
          <DialogDescription>{entityName}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : comments && comments.length > 0 ? (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border rounded-lg p-4 space-y-2 bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">
                    {comment.userName || comment.userEmail || t('unknownUser')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                      locale,
                    })}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('noComments')}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('writeComment')}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createCommentMutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createCommentMutation.isPending || !content.trim()}
            >
              {createCommentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('sending')}
                </>
              ) : (
                t('send')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
