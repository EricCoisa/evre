'use client';

import { useState } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { toast } from 'sonner';
import { Ban, CheckCircle2, ClipboardCheck, Send, XCircle } from 'lucide-react';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopyField } from '@/components/copy-field';
import Modal from '@/components/modal';
import { CapabilityGate } from '@/components/capability-gate';
import { CAPABILITIES } from '@/types/capabilities';
import { useTranslation } from '@/hooks/use-translation';
import { useCompanyContacts } from '@/lib/actions/company/queries';
import {
  useAcceptProposalOffline,
  useProposalSends,
  useProposalVersions,
  usePublishProposal,
  useRevokeProposalPublication,
  useSendProposal,
} from '@/lib/actions/proposal/queries';
import type { Proposal, ProposalVersionDto } from '@/lib/actions/proposal/types';
import { publicationStateLabelKey, type PublicationState } from '@/lib/vocabulary';

const STATE_BADGE_VARIANT: Record<PublicationState, VariantProps<typeof badgeVariants>['variant']> = {
  ACTIVE: 'default',
  EXPIRED: 'outline',
  REVOKED: 'destructive',
  NONE: 'secondary',
};

/** Deriva o que a tela precisa mostrar a partir da versão mais recente — extraído para manter a
 * complexidade do componente baixa (regra do projeto: `complexity` é warn em 10). */
function toPublicationView(latest: ProposalVersionDto | undefined) {
  const state = (latest?.state ?? 'NONE') as PublicationState;
  const canRevoke = state === 'ACTIVE' || state === 'EXPIRED';
  const publicUrl =
    canRevoke && latest?.publicToken && typeof window !== 'undefined'
      ? `${window.location.origin}/p/${latest.publicToken}`
      : undefined;
  return { state, canRevoke, publicUrl, shortUrl: canRevoke ? latest?.shortUrl : undefined };
}

/** Aba `publicacao`: publicar congela a versão atual numa `ProposalVersion` nova e revoga a
 * anterior no servidor (transação) — aqui só chama o endpoint e mostra o resultado, nunca decide
 * a regra. Estado mostrado vem sempre da última versão, nunca de uma coluna própria. */
export function ProposalPublicationTab({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation('proposal');
  const { t: tVocabulary } = useTranslation('vocabulary');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [note, setNote] = useState('');
  const { data: versions = [] } = useProposalVersions(proposal.id);
  const { data: contacts = [] } = useCompanyContacts(proposal.companyId ?? '');
  const { data: sends = [] } = useProposalSends(proposal.id);
  const publish = usePublishProposal();
  const revoke = useRevokeProposalPublication();
  const acceptOffline = useAcceptProposalOffline();
  const send = useSendProposal();

  const { state, canRevoke, publicUrl, shortUrl } = toPublicationView(versions[0]);
  const alreadyAccepted = proposal.status === 'ACCEPTED';
  const sendableContacts = contacts.filter((contact) => !!contact.phone);

  async function handleRegisterAcceptance() {
    if (!note.trim()) {
      toast.error(t('acceptanceNoteRequired'));
      return;
    }
    await acceptOffline.mutateAsync({ id: proposal.id, data: { note } });
    setNote('');
    setAcceptOpen(false);
  }

  async function handleSend(phone?: string) {
    const result = await send.mutateAsync({ id: proposal.id, data: { phone } });
    if (result.succeeded) {
      toast.success(t('sendSucceeded'));
    } else {
      toast.error(t('sendFailed'));
    }
    setSendOpen(false);
    setSelectedPhone('');
  }

  function handleSendClick() {
    if (sendableContacts.length > 1) {
      setSendOpen(true);
      return;
    }
    void handleSend();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('publicationState')}</span>
          <Badge variant={STATE_BADGE_VARIANT[state]}>{tVocabulary(publicationStateLabelKey(state))}</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => revoke.mutate(proposal.id)}
            disabled={!canRevoke || revoke.isPending}
          >
            <Ban className="size-4 mr-1.5" />
            {t('revokePublication')}
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={publish.isPending}>
            <Send className="size-4 mr-1.5" />
            {t('publishProposal')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setAcceptOpen(true)}
            disabled={alreadyAccepted || acceptOffline.isPending}
          >
            <ClipboardCheck className="size-4 mr-1.5" />
            {alreadyAccepted ? t('alreadyAcceptedShort') : t('registerAcceptance')}
          </Button>
          <CapabilityGate name={CAPABILITIES.messaging}>
            <Button
              variant="outline"
              onClick={handleSendClick}
              disabled={!canRevoke || send.isPending}
            >
              <Send className="size-4 mr-1.5" />
              {t('sendWhatsapp')}
            </Button>
          </CapabilityGate>
        </div>
      </div>

      {publicUrl ? (
        <CopyField value={publicUrl} label={t('publicUrl')} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('noActivePublication')}</p>
      )}
      {shortUrl && <CopyField value={shortUrl} label={t('shortUrl')} />}

      <div className="space-y-2">
        <span className="text-sm font-medium">{t('sendHistory')}</span>
        {sends.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sendHistoryEmpty')}</p>
        ) : (
          <ul className="space-y-1">
            {sends.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                {item.succeeded ? (
                  <CheckCircle2 className="size-4 text-green-600" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span>{item.channel}</span>
                {item.toPhone && <span className="text-muted-foreground">{item.toPhone}</span>}
                <span className="text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('publishConfirmTitle')}
        description={canRevoke ? t('publishConfirmDescriptionWithActive') : t('publishConfirmDescription')}
      >
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={async () => {
              await publish.mutateAsync(proposal.id);
              setConfirmOpen(false);
            }}
          >
            {t('publishProposal')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        title={t('registerAcceptance')}
        description={t('registerAcceptanceDescription')}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="acceptance-note">{t('acceptanceNote')}</Label>
            <Textarea
              id="acceptance-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('acceptanceNotePlaceholder')}
              disabled={acceptOffline.isPending}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setAcceptOpen(false)}
              disabled={acceptOffline.isPending}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleRegisterAcceptance} disabled={acceptOffline.isPending}>
              {t('registerAcceptance')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={t('sendChooseContact')}
        description={t('sendChooseContactDescription')}
      >
        <div className="space-y-3">
          <Select value={selectedPhone} onValueChange={setSelectedPhone}>
            <SelectTrigger>
              <SelectValue placeholder={t('sendChooseContactPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {sendableContacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.phone as string}>
                  {contact.name} — {contact.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={send.isPending}>
              {t('cancel')}
            </Button>
            <Button
              onClick={() => handleSend(selectedPhone)}
              disabled={!selectedPhone || send.isPending}
            >
              {t('sendConfirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
