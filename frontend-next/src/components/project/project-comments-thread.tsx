'use client';

import { useState } from 'react';
import { useComments, useCreateComment, useDeleteComment } from '@/lib/actions/project/queries';
import { useMe } from '@/lib/actions/auth/queries';
import { RichTextInput } from '@/components/rich-text-input';
import { RichTextViewer } from './rich-text-viewer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { ProjectComment } from '@/lib/actions/project/types';

interface ProjectCommentsThreadProps {
  projectId: string;
  entityType: 'PROJECT' | 'MILESTONE' | 'TASK';
  entityId: string;
  title?: string;
  className?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProjectCommentsThread({
  projectId,
  entityType,
  entityId,
  title,
  className,
}: ProjectCommentsThreadProps) {
  const { data: commentsResponse, isLoading } = useComments(projectId, {
    entityType,
    entityId,
  });
  const createCommentMutation = useCreateComment(projectId);
  const deleteCommentMutation = useDeleteComment(projectId);
  const { data: currentUser } = useMe();

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comments: ProjectComment[] = Array.isArray(commentsResponse)
    ? (commentsResponse as unknown as ProjectComment[])
    : ((commentsResponse as unknown as { data?: ProjectComment[] })?.data ?? []);

  const handleSendComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createCommentMutation.mutateAsync({
        entityType,
        entityId,
        content: trimmed,
      });
      setCommentText('');
    } catch {
      toast.error('Erro ao enviar comentário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteCommentMutation.mutateAsync(commentId);
      toast.success('Comentário removido');
    } catch {
      toast.error('Erro ao remover comentário');
    }
  };

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span>{title ?? 'Comentários'}</span>
        {comments.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-normal">
            {comments.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 items-start">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Nenhum comentário ainda. Alinhamentos ou dúvidas? Deixe uma mensagem abaixo.
        </div>
      ) : (
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {comments.map((comment) => {
            const isAuthor = currentUser?.id === comment.authorId;
            const canDelete = isAuthor || (currentUser?.role as unknown as string) === 'ADMIN';

            return (
              <div
                key={comment.id}
                className="group flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm hover:border-muted-foreground/30 transition-colors"
              >
                <Avatar className="h-7 w-7 text-xs flex-shrink-0 mt-0.5">
                  <AvatarImage src={comment.author?.imageUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(comment.author?.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {comment.author?.name ?? 'Usuário'}
                      {isAuthor && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                          (você)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Excluir comentário"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <RichTextViewer content={comment.content} className="text-xs text-foreground/90" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor de Novo Comentário */}
      <div className="space-y-2 pt-1">
        <RichTextInput
          ariaLabel="Novo comentário"
          placeholder="Escreva um comentário ou tire uma dúvida..."
          value={commentText}
          onChange={setCommentText}
          className="text-xs shadow-none border-muted"
          formatLabels={{
            bold: 'Negrito (*texto*)',
            italic: 'Itálico (_texto_)',
            strikethrough: 'Riscado (~texto~)',
            code: 'Código (```texto```)',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void handleSendComment();
            }
          }}
        />

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Dica: Ctrl + Enter para enviar
          </span>
          <Button
            size="sm"
            onClick={handleSendComment}
            disabled={!commentText.trim() || isSubmitting}
            className="h-7 text-xs px-3"
          >
            <Send className="mr-1.5 h-3 w-3" />
            Comentar
          </Button>
        </div>
      </div>
    </div>
  );
}
