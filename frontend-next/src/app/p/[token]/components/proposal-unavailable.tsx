'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { useRequestProposalRenewal } from '@/lib/actions/proposal-public/queries';

/** REVOKED e EXPIRED nunca mostram valor nem conteúdo — só o texto do estado (G7 do produto:
 * versão antiga não é mais visível). Só EXPIRED oferece "Pedir renovação". */
export function ProposalUnavailable({
  token,
  reason,
}: {
  token: string;
  reason: 'REVOKED' | 'EXPIRED';
}) {
  const { t } = useTranslation('proposal');
  const [requested, setRequested] = useState(false);
  const renewalMutation = useRequestProposalRenewal();

  async function handleRenewRequest() {
    try {
      await renewalMutation.mutateAsync(token);
      setRequested(true);
    } catch {
      // Alive já exibiu o toast de erro
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {reason === 'REVOKED' ? t('publicRevokedTitle') : t('publicExpiredTitle')}
          </CardTitle>
          <CardDescription>
            {reason === 'REVOKED' ? t('publicRevokedMessage') : t('publicExpiredMessage')}
          </CardDescription>
        </CardHeader>
        {reason === 'EXPIRED' ? (
          <CardContent className="flex justify-center">
            <Button onClick={handleRenewRequest} disabled={renewalMutation.isPending || requested}>
              {requested ? t('publicRenewRequestSent') : t('publicRenewRequest')}
            </Button>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
