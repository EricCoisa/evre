'use client';

import { useMemo, useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useMessagingConnections,
  useNativeButtonsSupport,
  useMetaTemplateCheck,
  useSubmitTemplate,
  useTemplateVariables,
} from '@/lib/actions/messaging/queries';
import { ArtifactPickerDialog } from '@/components/artifact-picker-dialog';
import {
  useTemplateHeaderImage,
  WHATSAPP_HEADER_IMAGE_FILTER,
  WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS,
} from '@/lib/messaging/template-header-image';
import { MetaRulesPanel } from './meta-rules-panel';
import type {
  MessagingConnection,
  MessagingTemplateCatalogItem,
  MessagingTemplateType,
  TemplateVariable,
} from '@/lib/actions/messaging/types';
import { connectionDisplayName } from '@/lib/messaging/connection';
import { getReservedDummyValue } from '@/lib/messaging/reserved-variables';
import { usedVariableNames } from '@/lib/messaging/template-variables';
import { WhatsappSimulator } from './template-preview';

/** Sugestão pronta por tipo: o operador só ajusta, em vez de inventar um valor do zero. */
function suggestedExample(variable: TemplateVariable): string {
  if (variable.default) return variable.default;
  switch (variable.type) {
    case 'NUMBER':
      return '123';
    case 'DATE':
      return new Date().toISOString().slice(0, 10);
    default:
      return '';
  }
}

/** Variáveis do tipo que o texto do template de fato cita — as únicas que a Meta pede exemplo. */
function variablesToExemplify(
  template: MessagingTemplateCatalogItem,
  type: MessagingTemplateType | undefined,
): TemplateVariable[] {
  // AUTHENTICATION tem corpo fixo da Meta: nada do nosso texto vai junto.
  if (template.category === 'AUTHENTICATION' || !type) return [];
  const used = usedVariableNames(
    template.body,
    template.header?.kind === 'TEXT' ? template.header.text : undefined,
    template.footer ?? undefined,
    ...(template.buttons ?? []).map((b) => (b.kind === 'URL' ? b.url : undefined)),
  );
  return type.variables.filter((variable) => used.has(variable.name));
}

/** Substitui `{{ nome }}` pelos exemplos — o que o revisor da Meta vai ler. */
function fillExamples(
  text: string,
  values: Record<string, string>,
  dummies: Record<string, string>,
): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, name: string) => {
    return values[name]?.trim() || dummies[name] || `[${name}]`;
  });
}

export function TemplateSubmitDialog({
  template,
  types,
  onOpenChange,
}: {
  template: MessagingTemplateCatalogItem | null;
  types: MessagingTemplateType[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('messaging');
  const { data: allConnections = [] } = useMessagingConnections();
  const { approvalConnectionIds } = useNativeButtonsSupport();
  // Só conexões com fluxo de aprovação podem receber o template.
  const connections = allConnections.filter((c) => approvalConnectionIds.includes(c.id));
  const submit = useSubmitTemplate();

  // Remonta o formulário a cada template (key): estado nasce zerado, sem efeito para resetar.
  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('submitTemplateTitle')}</DialogTitle>
          <DialogDescription>{t('submitTemplateDescription')}</DialogDescription>
        </DialogHeader>
        {template && (
          <SubmitForm
            key={template.id}
            template={template}
            type={types.find((item) => item.id === template.typeId)}
            connections={connections}
            isPending={submit.isPending}
            error={submit.error?.message}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (connectionId, examples, headerImageUrl) => {
              await submit.mutateAsync({ id: template.id, payload: { connectionId, examples, headerImageUrl } });
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function resolveInitialConnectionId(
  template: MessagingTemplateCatalogItem,
  connections: MessagingConnection[],
): string {
  const submitted = template.submissions ?? [];
  if (submitted.length === 1) return submitted[0].connectionId;
  return connections.length === 1 ? connections[0].id : '';
}

function SubmitExampleInputs({
  variables,
  values,
  missing,
  onChange,
  t,
}: {
  variables: TemplateVariable[];
  values: Record<string, string>;
  missing: TemplateVariable[];
  onChange: (name: string, val: string) => void;
  t: (key: string) => string;
}) {
  if (variables.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {t('examplesNone')}
      </p>
    );
  }

  return (
    <>
      {variables.map((variable) => {
        const inputType = variable.type === 'DATE' ? 'date' : variable.type === 'NUMBER' ? 'number' : 'text';
        return (
          <div key={variable.name} className="grid gap-1.5">
            <Label htmlFor={`example-${variable.name}`} className="flex items-center gap-2">
              <span className="font-mono text-xs">{variable.name}</span>
              <Badge variant="secondary" className="text-[10px]">
                {variable.type}
              </Badge>
            </Label>
            <Input
              id={`example-${variable.name}`}
              type={inputType}
              value={values[variable.name] ?? ''}
              placeholder={t(`examplePlaceholder.${variable.type}`)}
              aria-invalid={missing.includes(variable) || undefined}
              onChange={(e) => onChange(variable.name, e.target.value)}
            />
          </div>
        );
      })}
    </>
  );
}

function SubmitPreview({
  template,
  headerText,
  headerImage,
  values,
  dummies,
  t,
}: {
  template: MessagingTemplateCatalogItem;
  headerText?: string;
  headerImage?: string | null;
  values: Record<string, string>;
  dummies: Record<string, string>;
  t: (key: string) => string;
}) {
  const body =
    template.category === 'AUTHENTICATION'
      ? t('previewMetaFixedBody')
      : fillExamples(template.body, values, dummies);

  return (
    <div className="grid content-start gap-2">
      <p className="text-sm font-medium">{t('examplesPreview')}</p>
      <WhatsappSimulator
        headerText={headerText}
        headerImage={headerImage}
        body={body}
        footer={template.footer || undefined}
      />
    </div>
  );
}

function useSubmitFormState({
  template,
  type,
  connections,
  isPending,
}: {
  template: MessagingTemplateCatalogItem;
  type: MessagingTemplateType | undefined;
  connections: MessagingConnection[];
  isPending: boolean;
}) {
  const { data: reserved = [] } = useTemplateVariables();
  const dummies = useMemo(
    () => Object.fromEntries(reserved.map((v) => [v.name, getReservedDummyValue(v)])),
    [reserved],
  );
  const variables = useMemo(() => variablesToExemplify(template, type), [template, type]);
  const [connectionId, setConnectionId] = useState(() => resolveInitialConnectionId(template, connections));
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v.name, suggestedExample(v)])),
  );

  const hasImage = template.header?.kind === 'IMAGE';
  const headerImage = useTemplateHeaderImage();

  const missing = useMemo(
    () =>
      variables.filter(
        (v) => !values[v.name]?.trim() && !(v.required === false && v.default),
      ),
    [variables, values],
  );

  const { issues: metaIssues } = useMetaTemplateCheck(
    {
      category: template.category,
      body: template.body,
      header: template.header ?? null,
      footer: template.footer ?? null,
      buttons: template.buttons ?? null,
    },
    true,
  );
  const metaBlocked = metaIssues.some((issue) => issue.severity === 'error');
  const canSubmit =
    Boolean(connectionId) &&
    missing.length === 0 &&
    !isPending &&
    !headerImage.isPending &&
    !metaBlocked &&
    (!hasImage || Boolean(headerImage.draftArtifact));

  const headerText =
    template.header?.kind === 'TEXT' ? fillExamples(template.header.text, values, dummies) : undefined;

  return {
    dummies,
    variables,
    connectionId,
    setConnectionId,
    values,
    setValues,
    missing,
    metaIssues,
    canSubmit,
    headerText,
    hasImage,
    headerImage,
  };
}

function SubmitForm({
  template,
  type,
  connections,
  isPending,
  error,
  onCancel,
  onSubmit,
}: {
  template: MessagingTemplateCatalogItem;
  type: MessagingTemplateType | undefined;
  connections: MessagingConnection[];
  isPending: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (connectionId: string, examples: Record<string, string>, headerImageUrl?: string) => Promise<void>;
}) {
  const { t } = useTranslation('messaging');
  const {
    dummies,
    variables,
    connectionId,
    setConnectionId,
    values,
    setValues,
    missing,
    metaIssues,
    canSubmit,
    headerText,
    hasImage,
    headerImage,
  } = useSubmitFormState({ template, type, connections, isPending });

  async function submitWithArtifact() {
    const headerImageUrl = hasImage ? await headerImage.resolveUrl() : undefined;
    await onSubmit(connectionId, trimmed(values), headerImageUrl);
  }

  function handleSubmitClick() {
    if (hasImage && headerImage.needsPublishConfirm) {
      headerImage.setConfirmOpen(true);
      return;
    }
    void submitWithArtifact().catch(() => undefined);
  }

  return (
    <>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label>{t('connection')}</Label>
          <Select value={connectionId} onValueChange={setConnectionId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('connection')} />
            </SelectTrigger>
            <SelectContent>
              {connections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {connectionDisplayName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasImage && (
          <div className="grid gap-1.5">
            <Label>{t('submitHeaderImage')}</Label>
            {headerImage.draftArtifact ? (
              <div className="flex items-center gap-2">
                {headerImage.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headerImage.previewUrl} alt="" className="h-16 w-16 rounded object-cover border" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted">
                    <ImageIcon className="size-6 text-muted-foreground" />
                  </div>
                )}
                <span className="flex-1 truncate text-sm">{headerImage.draftArtifact.name ?? headerImage.draftArtifact.fileName}</span>
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
              <Button type="button" variant="outline" size="sm" onClick={() => headerImage.setPickerOpen(true)}>
                {t('selectImage')}
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <div>
              <p className="text-sm font-medium">{t('examplesTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('examplesHelp')}</p>
            </div>
            <SubmitExampleInputs
              variables={variables}
              values={values}
              missing={missing}
              onChange={(name, val) => setValues((prev) => ({ ...prev, [name]: val }))}
              t={t}
            />
            <p className="text-xs text-muted-foreground">{t('examplesReserved')}</p>
          </div>

          <SubmitPreview
            template={template}
            headerText={headerText}
            headerImage={hasImage ? (headerImage.previewUrl ?? null) : undefined}
            values={values}
            dummies={dummies}
            t={t}
          />
        </div>

        <MetaRulesPanel issues={metaIssues} />

        {error && (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmitClick}
          >
            {t('submitToMeta')}
          </Button>
        </DialogFooter>
      </div>

      <ArtifactPickerDialog
        open={headerImage.pickerOpen}
        onOpenChange={headerImage.setPickerOpen}
        onSelect={(artifact) => { headerImage.setDraftArtifact(artifact); headerImage.setPickerOpen(false); }}
        filter={WHATSAPP_HEADER_IMAGE_FILTER}
        uploadConstraints={WHATSAPP_HEADER_IMAGE_UPLOAD_CONSTRAINTS}
      />

      {/* Confirmação de que a imagem se tornará pública */}
      <Dialog open={headerImage.confirmOpen} onOpenChange={headerImage.setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmPublicImageTitle')}</DialogTitle>
            <DialogDescription>{t('confirmPublicImageDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => headerImage.setConfirmOpen(false)} disabled={headerImage.isPending}>
              {t('cancel')}
            </Button>
            <Button
              onClick={async () => {
                headerImage.setConfirmOpen(false);
                await submitWithArtifact();
              }}
              disabled={headerImage.isPending}
            >
              {t('confirmPublicImageConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function trimmed(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value),
  );
}
