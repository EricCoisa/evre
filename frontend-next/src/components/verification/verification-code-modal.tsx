'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestVerification, useConfirmVerification } from '@/lib/actions/verification/queries';
import type { VerificationChallenge } from '@/lib/actions/verification/types';

const RESEND_COOLDOWN_MS = 60_000;

/** Modal genérico de verificação por propósito/canal/alvo, aberto via retry bloqueado ou manualmente. */
export function VerificationCodeModal({
  challenge,
  onConfirmed,
  onCancelled,
}: {
  challenge: VerificationChallenge | null;
  onConfirmed: () => void;
  onCancelled: () => void;
}) {
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation('common');

  const requestMutation = useRequestVerification();
  const confirmMutation = useConfirmVerification();

  const [code, setCode] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [canResend, setCanResend] = useState(false);

  // StrictMode roda este efeito 2x no mount (dev) — sem isto, abrir o modal manda 2 códigos de
  // uma vez (o 2º às vezes cai no cooldown de reenvio, às vezes gera um código que não é o que o
  // usuário recebeu). O ref sobrevive ao double-invoke porque StrictMode não reseta refs.
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!challenge) { requestedFor.current = null; return; }
    const key = `${challenge.purpose}:${challenge.target}`;
    if (requestedFor.current === key) return;
    requestedFor.current = key;

    setCode('');
    setHasSubmitted(false);
    setCanResend(false);
    // Abrir o modal É o gatilho do envio — uma falha (ex. canal indisponível) aparece no toast
    // padrão imediatamente, em vez de deixar o usuário esperando um código que não vem.
    requestMutation.mutate(challenge, {
      onSettled: () => setTimeout(() => setCanResend(true), RESEND_COOLDOWN_MS),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.purpose, challenge?.target]);

  const canSave = /^\d{6}$/.test(code) && !confirmMutation.isPending;

  const handleResend = () => {
    if (!challenge) return;
    setCanResend(false);
    requestMutation.mutate(challenge, {
      onSettled: () => setTimeout(() => setCanResend(true), RESEND_COOLDOWN_MS),
    });
  };

  const handleSubmit = async () => {
    setHasSubmitted(true);
    if (!canSave || !challenge) return;

    try {
      await confirmMutation.mutateAsync({ purpose: challenge.purpose, code });
      toast.success(t('verification_confirmed'));
      onConfirmed();
    } catch {
      // Alive já mostrou o toast de erro — mantém o modal aberto para corrigir.
    }
  };

  return (
    <Dialog open={!!challenge} onOpenChange={(next) => !next && onCancelled()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('verification_title')}</DialogTitle>
          <DialogDescription>
            {t('verification_description', { target: challenge?.target ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="verification-code">{t('verification_code_label')}</Label>
          <Input
            id="verification-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {hasSubmitted && !/^\d{6}$/.test(code) && (
            <p className="text-[0.8rem] text-destructive">{t('verification_code_invalid')}</p>
          )}
        </div>

        <Button type="button" variant="link" className="justify-start px-0" disabled={!canResend} onClick={handleResend}>
          {t('verification_resend')}
        </Button>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelled}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleSubmit}>
            {tCommon('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
