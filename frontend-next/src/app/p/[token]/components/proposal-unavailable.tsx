'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { SITE_NAME } from '@/lib/site';
import { requestProposalRenewal } from '@/lib/actions/proposal-public/api';

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
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  async function handleRenewRequest() {
    setRequesting(true);
    const response = await requestProposalRenewal(token);
    setRequesting(false);
    if (response.success) {
      setRequested(true);
    } else {
      toast.error(response.message);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <p className="text-sm font-medium text-muted-foreground">{SITE_NAME}</p>
          <CardTitle className="text-xl">
            {reason === 'REVOKED' ? t('publicRevokedTitle') : t('publicExpiredTitle')}
          </CardTitle>
          <CardDescription>
            {reason === 'REVOKED' ? t('publicRevokedMessage') : t('publicExpiredMessage')}
          </CardDescription>
        </CardHeader>
        {reason === 'EXPIRED' ? (
          <CardContent className="flex justify-center">
            <Button onClick={handleRenewRequest} disabled={requesting || requested}>
              {requested ? t('publicRenewRequestSent') : t('publicRenewRequest')}
            </Button>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
