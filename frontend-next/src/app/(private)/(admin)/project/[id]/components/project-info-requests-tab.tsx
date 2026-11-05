'use client';

import { useState } from 'react';
import { useInfoRequests, useCreateInfoRequest } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { Alive } from '@/lib/api/collector';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { formatDate } from '@/lib/utils';

const STATUS_ICON = {
  PENDING: Clock,
  ANSWERED: CheckCircle2,
  EXPIRED: XCircle,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  ANSWERED: "default",
  EXPIRED: "destructive",
};

export function ProjectInfoRequestsTab({ projectId }: { projectId: string }) {
  const { t } = useTranslation('project');
  const { data: requestsData, isLoading } = useInfoRequests(projectId);
  const createMutation = useCreateInfoRequest(projectId);
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const requests: any[] = (requestsData as any)?.data ?? [];

  const schema = z.object({
    label: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  });

  const fields: FormBuilderField[] = [
    { name: 'label', label: 'Label', placeholder: 'Ex: Credenciais do serviço X' },
    { name: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descreva o que precisa' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('infoRequests')}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && requests.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação</p>
      )}

      <div className="grid gap-3">
        {requests.map((req: any) => {
          const Icon = STATUS_ICON[req.status as keyof typeof STATUS_ICON] ?? Clock;
          return (
            <Card key={req.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium text-sm">{req.label}</span>
                    </div>
                    {req.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {req.requestedBy?.name ?? 'Sistema'} · {formatDate(req.createdAt)}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[req.status] ?? "outline"}>
                    {req.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FormBuilderModal
        size="md"
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={t('infoRequests')}
        description="Solicitar informação ao cliente"
        schema={schema}
        fields={fields}
        mode="create"
        onSubmit={async (data) => {
          const result = await Alive(() => createMutation.mutateAsync(data))();
          return result;
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['project', projectId, 'info-requests'] });
        }}
        submitLabel="Solicitar"
      />
    </div>
  );
}
