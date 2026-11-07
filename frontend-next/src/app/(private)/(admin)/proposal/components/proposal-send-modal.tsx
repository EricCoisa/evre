'use client';

import { useMemo, useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Modal from '@/components/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PhoneInput } from '@/components/ui/phone-input';
import { ArtifactPickerDialog } from '@/components/artifact-picker-dialog';
import { useTranslation } from '@/hooks/use-translation';
import { useArtifactPreviewUrl, usePublishArtifact } from '@/lib/actions/artifact/queries';
import { useCompany } from '@/lib/actions/company/queries';
import { useTemplateTypes, useTemplates, useTemplateVariables } from '@/lib/actions/messaging/queries';
import type {
  MessagingTemplateCatalogItem,
  MessagingTemplateType,
  ReservedVariable,
  TemplateVariable,
} from '@/lib/actions/messaging/types';
import type { Artifact } from '@/lib/actions/artifact/types';
import type { Proposal } from '@/lib/actions/proposal/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const IMAGE_FILTER = (a: Artifact) =>
  a.kind === 'FILE' && typeof a.contentType === 'string' && a.contentType.startsWith('image/');

// Meta: imagem de cabeçalho — JPEG/PNG/WEBP, ≤5 MB, proporção 1.91:1 (800×418).
const IMAGE_UPLOAD_CONSTRAINTS = {
  maxSizeBytes: 5_000_000,
  aspectRatio: { width: 191, height: 100, tolerancePct: 0.15 },
  accept: 'image/jpeg,image/png,image/webp',
};

export interface ProposalSendDraft {
  templateId?: string;
  values?: Record<string, string>;
  headerImageUrl?: string;
  phone?: string;
}

function nonReservedVariables(
  selected: MessagingTemplateCatalogItem | undefined,
  types: MessagingTemplateType[],
  reserved: ReservedVariable[],
): TemplateVariable[] {
  if (!selected) return [];
  const reservedNames = new Set(reserved.map((r) => r.name));
  const allVars = types.find((t) => t.id === selected.typeId)?.variables ?? [];
  return allVars.filter((v) => !reservedNames.has(v.name));
}

/** Modal de envio de proposta por WhatsApp. */
export function ProposalSendModal({
  open,
  onOpenChange,
  proposal,
  contacts,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  contacts: { phone: string; name?: string | null }[];
  pending: boolean;
  onSubmit: (draft: ProposalSendDraft) => void;
}) {
  const { t } = useTranslation('proposal');
  const { data: templatesPage } = useTemplates({ pagination: false } as never);
  const { data: typesPage } = useTemplateTypes({ pagination: false } as never);
  const { data: reservedData } = useTemplateVariables();
  const { data: company } = useCompany(proposal.companyId);
  const publishArtifact = usePublishArtifact();

  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [draftArtifact, setDraftArtifact] = useState<Artifact | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phone, setPhone] = useState(contacts.length === 1 ? contacts[0].phone : '');

  // URL de preview (presigned, autenticada) — só para exibir a miniatura antes de publicar.
  const { data: previewData } = useArtifactPreviewUrl(draftArtifact?.id);
  const previewUrl = previewData?.url;

  const templates: MessagingTemplateCatalogItem[] = Array.isArray(templatesPage)
    ? templatesPage
    : (templatesPage as { data?: MessagingTemplateCatalogItem[] } | undefined)?.data ?? [];
  const types: MessagingTemplateType[] = Array.isArray(typesPage)
    ? typesPage
    : (typesPage as { data?: MessagingTemplateType[] } | undefined)?.data ?? [];
  const reserved: ReservedVariable[] = reservedData ?? [];

  const available = templates.filter((tpl) => !tpl.invalidReason);
  const selected = available.find((tpl) => tpl.id === templateId);
  const variables = nonReservedVariables(selected, types, reserved);
  const hasImage = selected?.header?.kind === 'IMAGE';

  // company_name é pré-preenchida via memo: defaults abaixo, overrides do usuário acima.
  const effectiveValues = useMemo(() => {
    if (company?.name && variables.some((v) => v.name === 'company_name')) {
      return { company_name: company.name, ...values };
    }
    return values;
  }, [company?.name, values, variables]);

  const valid =
    Boolean(selected) &&
    variables.every((v) => v.required === false || Boolean(effectiveValues[v.name]?.trim())) &&
    (!hasImage || Boolean(draftArtifact)) &&
    Boolean(phone);

  function pickTemplate(id: string) {
    setTemplateId(id);
    setValues({});
    setDraftArtifact(null);
  }

  // Clique em "Enviar" abre confirmação se houver imagem pendente de publicação.
  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    if (hasImage && draftArtifact && !(draftArtifact.published && draftArtifact.publicToken)) {
      setConfirmOpen(true);
      return;
    }
    submitWithCurrentDraft();
  }

  async function submitWithCurrentDraft() {
    let headerImageUrl: string | undefined;
    if (hasImage && draftArtifact) {
      const target =
        draftArtifact.published && draftArtifact.publicToken
          ? draftArtifact
          : await publishArtifact.mutateAsync({ id: draftArtifact.id, isPublic: true });
      headerImageUrl = `${API_BASE_URL}/artifacts/public/${target.publicToken}`;
    }
    onSubmit({
      templateId: selected!.id,
      values: Object.keys(effectiveValues).length ? effectiveValues : undefined,
      headerImageUrl,
      phone: phone || undefined,
    });
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={t('sendWhatsappTitle')}
        description={t('sendWhatsappDescription')}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Template */}
          <div className="space-y-1.5">
            <Label htmlFor="proposal-template">{t('sendTemplateLabel')}</Label>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('sendNoTemplates')}</p>
            ) : (
              <Select value={templateId} onValueChange={pickTemplate}>
                <SelectTrigger id="proposal-template">
                  <SelectValue placeholder={t('sendTemplatePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.key} ({tpl.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Variáveis */}
          {variables.map((v) => (
            <div key={v.name} className="space-y-1.5">
              <Label htmlFor={`prop-var-${v.name}`}>
                {v.name}
                {v.required === false ? ` (${t('variableOptional')})` : ''}
              </Label>
              <Input
                id={`prop-var-${v.name}`}
                value={effectiveValues[v.name] ?? ''}
                onChange={(e) => setValues((cur) => ({ ...cur, [v.name]: e.target.value }))}
              />
            </div>
          ))}

          {/* Imagem de header */}
          {hasImage && (
            <div className="space-y-1.5">
              <Label>{t('sendHeaderImage')}</Label>
              {draftArtifact ? (
                <div className="flex items-center gap-2">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="" className="h-16 w-16 rounded object-cover border" />
                  ) : (
                    <div className="h-16 w-16 rounded border flex items-center justify-center bg-muted">
                      <ImageIcon className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm truncate flex-1">{draftArtifact.name ?? draftArtifact.fileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() => setDraftArtifact(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                >
                  {t('selectImage')}
                </Button>
              )}
            </div>
          )}

          {/* Telefone */}
          <div className="space-y-1.5">
            {contacts.length > 0 && (
              <Select value={phone} onValueChange={setPhone}>
                <SelectTrigger>
                  <SelectValue placeholder={t('sendChooseContactPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.phone} value={c.phone}>
                      {c.name ? `${c.name} — ` : ''}{c.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Label htmlFor="prop-phone">{t('sendManualPhone')}</Label>
            <PhoneInput id="prop-phone" value={phone} onChange={setPhone} disabled={pending} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {t('sendConfirm')}
            </Button>
          </div>
        </form>
      </Modal>

      <ArtifactPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(artifact) => { setDraftArtifact(artifact); setPickerOpen(false); }}
        filter={IMAGE_FILTER}
        uploadConstraints={IMAGE_UPLOAD_CONSTRAINTS}
      />

      {/* Confirmação de que a imagem se tornará pública */}
      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('confirmPublicImageTitle')}
        description={t('confirmPublicImageDescription')}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={publishArtifact.isPending}>
            {t('cancel')}
          </Button>
          <Button
            onClick={async () => {
              setConfirmOpen(false);
              await submitWithCurrentDraft();
            }}
            disabled={publishArtifact.isPending}
          >
            {t('confirmPublicImageConfirm')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
