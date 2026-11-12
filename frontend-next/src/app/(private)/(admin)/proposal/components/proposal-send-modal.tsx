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
import { useCompany } from '@/lib/actions/company/queries';
import { useTemplateTypes, useTemplates, useTemplateVariables } from '@/lib/actions/messaging/queries';
import {
  useTemplateHeaderImage,
  WHATSAPP_HEADER_IMAGE_FILTER,
  WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS,
} from '@/lib/messaging/template-header-image';
import type {
  MessagingTemplateCatalogItem,
  MessagingTemplateType,
  ReservedVariable,
  TemplateVariable,
} from '@/lib/actions/messaging/types';
import type { Proposal } from '@/lib/actions/proposal/types';

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

  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState(contacts.length === 1 ? contacts[0].phone : '');
  const headerImage = useTemplateHeaderImage();

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
    (!hasImage || Boolean(headerImage.draftArtifact)) &&
    Boolean(phone);

  function pickTemplate(id: string) {
    setTemplateId(id);
    setValues({});
    headerImage.setDraftArtifact(null);
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    if (hasImage && headerImage.needsPublishConfirm) {
      headerImage.setConfirmOpen(true);
      return;
    }
    void submitWithCurrentDraft();
  }

  async function submitWithCurrentDraft() {
    const headerImageUrl = hasImage ? await headerImage.resolveUrl() : undefined;
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
              {headerImage.draftArtifact ? (
                <div className="flex items-center gap-2">
                  {headerImage.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={headerImage.previewUrl} alt="" className="h-16 w-16 rounded object-cover border" />
                  ) : (
                    <div className="h-16 w-16 rounded border flex items-center justify-center bg-muted">
                      <ImageIcon className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm truncate flex-1">{headerImage.draftArtifact.name ?? headerImage.draftArtifact.fileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() => headerImage.setDraftArtifact(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => headerImage.setPickerOpen(true)}
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
        open={headerImage.pickerOpen}
        onOpenChange={headerImage.setPickerOpen}
        onSelect={(artifact) => { headerImage.setDraftArtifact(artifact); headerImage.setPickerOpen(false); }}
        filter={WHATSAPP_HEADER_IMAGE_FILTER}
        uploadConstraints={WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS}
      />

      {/* Confirmação de que a imagem se tornará pública */}
      <Modal
        open={headerImage.confirmOpen}
        onOpenChange={headerImage.setConfirmOpen}
        title={t('confirmPublicImageTitle')}
        description={t('confirmPublicImageDescription')}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => headerImage.setConfirmOpen(false)} disabled={headerImage.isPending}>
            {t('cancel')}
          </Button>
          <Button
            onClick={async () => {
              headerImage.setConfirmOpen(false);
              await submitWithCurrentDraft();
            }}
            disabled={headerImage.isPending}
          >
            {t('confirmPublicImageConfirm')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
