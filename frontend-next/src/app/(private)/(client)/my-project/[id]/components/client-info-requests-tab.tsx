'use client';

import { useState } from 'react';
import {
  useInfoRequests,
  useAnswerInfoRequest,
} from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import {
  FormBuilderModal,
  type FormBuilderField,
} from '@/components/form/form-builder';
import { Alive } from '@/lib/api/collector';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { InfoRequest } from '@/lib/actions/project/types';
import { formatDate } from '@/lib/utils';

const STATUS_ICON = {
  PENDING: Clock,
  ANSWERED: CheckCircle2,
  EXPIRED: XCircle,
};

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  PENDING: 'outline',
  ANSWERED: 'default',
  EXPIRED: 'destructive',
};

export function ClientInfoRequestsTab({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation('project');
  const { data: requestsData, isLoading } = useInfoRequests(projectId);
  const answerMutation = useAnswerInfoRequest(projectId);
  const queryClient = useQueryClient();
  const [answeringRequest, setAnsweringRequest] = useState<InfoRequest | null>(null);

  const requests = Array.isArray(requestsData) ? requestsData : requestsData?.data ?? [];

  const answerSchema = z.object({
    value: z.string().min(1).max(5000),
  });

  const answerFields: FormBuilderField[] = [
    {
      name: 'value',
      label: 'Resposta',
      type: 'textarea',
      placeholder: 'Digite sua resposta',
    },
  ];

  return (
    <div className="space-y-4">
      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      )}

      {!isLoading && requests.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma solicitação
        </p>
      )}

      <div className="grid gap-3">
        {requests.map((req) => {
          const Icon =
            STATUS_ICON[req.status as keyof typeof STATUS_ICON] ?? Clock;
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
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {req.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {req.requestedBy?.name ?? 'Sistema'} ·{' '}
                      {formatDate(req.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={STATUS_VARIANT[req.status] ?? 'outline'}>
                      {req.status}
                    </Badge>
                    {req.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAnsweringRequest(req)}
                      >
                        Responder
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FormBuilderModal
        size="md"
        open={!!answeringRequest}
        onOpenChange={(open) => !open && setAnsweringRequest(null)}
        title={answeringRequest?.label ?? t('infoRequests')}
        description={answeringRequest?.description ?? ''}
        schema={answerSchema}
        fields={answerFields}
        mode="create"
        onSubmit={async (data) => {
          if (!answeringRequest) return;
          const result = await Alive(() =>
            answerMutation.mutateAsync({
              requestId: answeringRequest.id,
              data: { value: data.value },
            }),
          )();
          return result;
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['project', projectId, 'info-requests'],
          });
          setAnsweringRequest(null);
        }}
        submitLabel="Enviar"
      />
    </div>
  );
}
