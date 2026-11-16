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
import { useTemplateTypes, useTemplates } from '@/lib/actions/messaging/queries';
import {
  useTemplateHeaderImage,
  WHATSAPP_HEADER_IMAGE_FILTER,
  WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS,
} from '@/lib/messaging/template-header-image';
import type {
  MessagingTemplateCatalogItem,
  MessagingTemplateType,
  TemplateVariable,
} from '@/lib/actions/messaging/types';
import type { Proposal } from '@/lib/actions/proposal/types';

export interface ProposalSendDraft {
  templateId?: string;
  values?: Record<string, string>;
  headerImageUrl?: string;
  phone?: string;
}

function templateVariables(
  selected: MessagingTemplateCatalogItem | undefined,
  types: MessagingTemplateType[],
): TemplateVariable[] {
  if (!selected) return [];
  return types.find((t) => t.id === selected.typeId)?.variables ?? [];
}

function resolveListPage<T>(page: T[] | { data?: T[] } | undefined): T[] {
  if (Array.isArray(page)) return page;
  return page?.data ?? [];
}

function firstNameOf(contact: { name?: string | null } | undefined): string {
  return contact?.name?.split(' ')[0] ?? '';
}

function isImageHeader(selected: MessagingTemplateCatalogItem | undefined): boolean {
  return selected?.header?.kind === 'IMAGE';
}

function isSendValid({
  selected,
  variables,
  effectiveValues,
  hasImage,
  hasHeaderImageDraft,
  phone,
}: {
  selected: MessagingTemplateCatalogItem | undefined;
  variables: TemplateVariable[];
  effectiveValues: Record<string, string>;
  hasImage: boolean;
  hasHeaderImageDraft: boolean;
  phone: string;
}): boolean {
  if (!selected || !phone) return false;
  if (hasImage && !hasHeaderImageDraft) return false;
  return variables.every((v) => v.required === false || Boolean(effectiveValues[v.name]?.trim()));
}

function TemplateSelect({
  available,
  templateId,
  onChange,
  t,
}: {
  available: MessagingTemplateCatalogItem[];
  templateId: string;
  onChange: (id: string) => void;
  t: (key: string) => string;
}) {
  if (available.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('sendNoTemplates')}</p>;
  }
  return (
    <Select value={templateId} onValueChange={onChange}>
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
  );
}

function HeaderImageSection({
  show,
  draftArtifact,
  previewUrl,
  onRemove,
  onPick,
  t,
}: {
  show: boolean;
  draftArtifact: { name: string | null; fileName: string } | null | undefined;
  previewUrl: string | undefined;
  onRemove: () => void;
  onPick: () => void;
  t: (key: string) => string;
}) {
  if (!show) return null;
  return (
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
          <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" onClick={onRemove}>
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={onPick}>
          {t('selectImage')}
        </Button>
      )}
    </div>
  );
}

function PhoneSection({
  contacts,
  phone,
  setPhone,
  pending,
  t,
}: {
  contacts: { phone: string; name?: string | null }[];
  phone: string;
  setPhone: (phone: string) => void;
  pending: boolean;
  t: (key: string) => string;
}) {
  const hasContacts = contacts.length > 0;
  return (
    <div className="space-y-1.5">
      {hasContacts && (
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
      <Label htmlFor="prop-phone">{hasContacts ? t('sendManualPhone') : t('sendPhone')}</Label>
      <PhoneInput id="prop-phone" value={phone} onChange={setPhone} disabled={pending} />
    </div>
  );
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
  const { data: company } = useCompany(proposal.companyId);

  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState(contacts.length === 1 ? contacts[0].phone : '');
  const headerImage = useTemplateHeaderImage();

  const templates = resolveListPage<MessagingTemplateCatalogItem>(templatesPage);
  const types = resolveListPage<MessagingTemplateType>(typesPage);

  const available = templates.filter((tpl) => !tpl.invalidReason);
  const selected = available.find((tpl) => tpl.id === templateId);
  const variables = templateVariables(selected, types);
  const selectedContact = contacts.find((c) => c.phone === phone);
  const contactFirstName = firstNameOf(selectedContact);
  const hasImage = isImageHeader(selected);

  // Variáveis reservadas pré-preenchidas; o operador pode sobrescrever qualquer campo.
  const effectiveValues = useMemo(() => {
    const defaults: Record<string, string> = {};
    if (company?.name && variables.some((v) => v.name === 'company_name')) {
      defaults.company_name = company.name;
    }
    if (contactFirstName && variables.some((v) => v.name === 'first_name')) {
      defaults.first_name = contactFirstName;
    }
    return { ...defaults, ...values };
  }, [company?.name, contactFirstName, values, variables]);

  const valid = isSendValid({
    selected,
    variables,
    effectiveValues,
    hasImage,
    hasHeaderImageDraft: Boolean(headerImage.draftArtifact),
    phone,
  });

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
            <TemplateSelect available={available} templateId={templateId} onChange={pickTemplate} t={t} />
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
          <HeaderImageSection
            show={hasImage}
            draftArtifact={headerImage.draftArtifact}
            previewUrl={headerImage.previewUrl}
            onRemove={() => headerImage.setDraftArtifact(null)}
            onPick={() => headerImage.setPickerOpen(true)}
            t={t}
          />

          {/* Telefone */}
          <PhoneSection contacts={contacts} phone={phone} setPhone={setPhone} pending={pending} t={t} />

          <div className="flex gap-3 pt-4 border-t border-border/50">
            <Button type="submit" disabled={!valid || pending}>
              {t('sendConfirm')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('cancel')}
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
        <div className="flex gap-3 pt-4 border-t border-border/50">
          <Button
            onClick={async () => {
              headerImage.setConfirmOpen(false);
              await submitWithCurrentDraft();
            }}
            disabled={headerImage.isPending}
          >
            {t('confirmPublicImageConfirm')}
          </Button>
          <Button variant="outline" onClick={() => headerImage.setConfirmOpen(false)} disabled={headerImage.isPending}>
            {t('cancel')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
