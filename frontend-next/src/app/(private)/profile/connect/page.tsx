'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/container';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import {
  useApproveAuthorization,
  useAuthorizationRequest,
} from '@/lib/actions/mcp/queries';
import type { McpScope } from '@/lib/actions/mcp/types';

/** Tela de consentimento OAuth do conector MCP. */
export default function ConnectPage() {
  const { t } = useTranslation('profile');
  const router = useRouter();
  const params = useSearchParams();
  const req = params.get('req');

  const { data: request, error, isPending } = useAuthorizationRequest(req);
  const approve = useApproveAuthorization();

  // null significa que o usuário ainda não alterou os scopes pedidos pelo cliente
  const [picked, setPicked] = useState<McpScope[] | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const scopes = picked ?? request?.requestedScopes ?? [];

  // Sem `req`, ou com um `req` expirado/forjado, não há nada a consentir.
  if (!req || error) {
    return <Container variant="form"><ErrorState /></Container>;
  }
  if (isPending || !request) {
    return <Container variant="form">{t('loading')}...</Container>;
  }

  const toggle = (scope: McpScope) =>
    setPicked(
      scopes.includes(scope)
        ? scopes.filter((s) => s !== scope)
        : [...scopes, scope],
    );

  const handleApprove = async () => {
    try {
      const result = await approve.mutateAsync({ req, scopes });
      setRedirectTo(result.redirectTo);
    } catch {
      // Alive já mostrou o toast de erro.
    }
  };

  const handleDeny = () => {
    // Negar é não emitir code; o cliente cai no próprio timeout.
    router.push('/profile?tab=connectors');
  };

  return (
    <Container variant="form">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">
            {t('connectTitle', { client: request.clientName })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('connectDescription', { client: request.clientName })}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">{t('connectScopesTitle')}</p>
          <p className="text-sm text-muted-foreground">
            {t('connectScopesHint')}
          </p>
          {request.availableScopes.map((scope) => (
            <div key={scope} className="flex items-center gap-2">
              <Checkbox
                id={`scope-${scope}`}
                checked={scopes.includes(scope)}
                onCheckedChange={() => toggle(scope)}
              />
              <Label htmlFor={`scope-${scope}`}>
                {t(`scope_${scope.replace(/[:-]/g, '_').toLowerCase()}`)}
              </Label>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground break-all">
          {t('connectRedirectTo')}: {request.redirectUri}
        </p>

        <div className="flex gap-2">
          <Button
            onClick={handleApprove}
            disabled={approve.isPending || !!redirectTo}
          >
            {t('connectApprove')}
          </Button>
          <Button variant="outline" onClick={handleDeny}>
            {t('connectDeny')}
          </Button>
        </div>
      </div>

      <Dialog open={!!redirectTo}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('connectSuccessTitle')}</DialogTitle>
            <DialogDescription>
              {t('connectSuccessDescription', { client: request.clientName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                if (redirectTo) window.location.href = redirectTo;
              }}
            >
              {t('connectSuccessContinue', { client: request.clientName })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
