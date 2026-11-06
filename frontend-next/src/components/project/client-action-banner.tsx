'use client';

import { useInfoRequests } from '@/lib/actions/project/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KeyRound, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { InfoRequest } from '@/lib/actions/project/types';

interface ClientActionBannerProps {
  projectId: string;
  onGoToRequests?: () => void;
  onRequestAnswer?: (request: InfoRequest) => void;
  mode?: 'admin' | 'client';
}

export function ClientActionBanner({
  projectId,
  onGoToRequests,
  onRequestAnswer,
  mode = 'client',
}: ClientActionBannerProps) {
  const { data: requestsData } = useInfoRequests(projectId);

  const requests: InfoRequest[] = Array.isArray(requestsData)
    ? requestsData
    : requestsData?.data ?? [];

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  if (pendingRequests.length === 0) {
    return null;
  }

  const firstPending = pendingRequests[0];

  return (
    <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-950 dark:text-amber-200 shadow-sm transition-all">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-500/10 dark:bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {mode === 'client'
                  ? 'Atenção: A equipe precisa de você para continuar!'
                  : 'Pendências com o Cliente'}
              </span>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
                {pendingRequests.length} {pendingRequests.length === 1 ? 'pendência' : 'pendências'}
              </Badge>
            </div>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              {mode === 'client' ? (
                <>
                  Item prioritário: <strong className="font-medium">{firstPending.label}</strong>
                  {firstPending.description ? ` — ${firstPending.description}` : ''}
                </>
              ) : (
                <>
                  Aguardando resposta do cliente para:{' '}
                  <strong className="font-medium">{firstPending.label}</strong>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
          {mode === 'client' && onRequestAnswer ? (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 h-8 text-xs font-medium"
              onClick={() => onRequestAnswer(firstPending)}
            >
              Responder Agora
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          ) : (
            onGoToRequests && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/40 hover:bg-amber-500/10 text-amber-900 dark:text-amber-200 h-8 text-xs"
                onClick={onGoToRequests}
              >
                Ver Solicitações
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

