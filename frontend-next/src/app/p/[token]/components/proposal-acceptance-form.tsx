'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Modal from '@/components/modal';
import { useTranslation } from '@/hooks/use-translation';
import { formatCents, formatDate, formatDateOnly } from '@/lib/utils';
import { useAcceptPublicProposal } from '@/lib/actions/proposal-public/queries';
import type { PublicProposalDto } from '@/lib/generated/schemas';

/** Bloco de aceite no fim da proposta pública — só este componente é `'use client'`, a página
 * segue Server Component. Idempotente no servidor: recarregar depois de aceitar (ou um segundo
 * clique em voo) só mostra o mesmo estado aceito, nunca duplica a decisão. */
export function ProposalAcceptanceForm({
  token,
  envelope,
  initialAcceptedAt,
}: {
  token: string;
  envelope: PublicProposalDto['envelope'];
  initialAcceptedAt: string | null | undefined;
}) {
  const { t } = useTranslation('proposal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState(initialAcceptedAt ?? null);
  const acceptMutation = useAcceptPublicProposal();
  const submitting = acceptMutation.isPending;

  if (acceptedAt) {
    return (
      <section className="rounded-lg border bg-muted/30 p-4">
        <h2 className="text-lg font-semibold text-foreground">{t('acceptedTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('acceptedMessage', { date: formatDate(acceptedAt) })}
        </p>
      </section>
    );
  }

  function openConfirm() {
    if (!name.trim() || !email.trim()) {
      toast.error(t('acceptFieldsRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(t('invalidEmail'));
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    try {
      const result = await acceptMutation.mutateAsync({ token, data: { name, email } });
      setAcceptedAt(result.acceptedAt);
    } catch {
      // Alive já exibiu o toast de erro
    } finally {
      setConfirmOpen(false);
    }
  }

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t('acceptSectionTitle')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="accept-name">{t('acceptName')}</Label>
          <Input
            id="accept-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('acceptNamePlaceholder')}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accept-email">{t('acceptEmail')}</Label>
          <Input
            id="accept-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('acceptEmailPlaceholder')}
            disabled={submitting}
          />
        </div>
      </div>
      <Button onClick={openConfirm} disabled={submitting}>
        {t('acceptButton')}
      </Button>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('acceptConfirmTitle')}
        description={t('acceptConfirmDescription')}
      >
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('value')}</dt>
            <dd className="font-medium">{formatCents(envelope.totalCents, envelope.currency)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('termDays')}</dt>
            <dd className="font-medium">{envelope.termDays ?? '-'}</dd>
          </div>
          {envelope.validUntil ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('validUntil')}</dt>
              <dd className="font-medium">{formatDateOnly(envelope.validUntil)}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {t('acceptConfirmButton')}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
