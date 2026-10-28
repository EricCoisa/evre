'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import {
  useTemplatesForConnection,
  useTemplateTypes,
  useTemplateVariables,
} from '@/lib/actions/messaging/queries';
import type {
  MessagingCapabilities,
  MessagingTemplateCatalogItem,
  MessagingTemplateType,
  TemplateVariable,
  ReservedVariable,
} from '@/lib/actions/messaging/types';
import { usedVariableNames } from '@/lib/messaging/template-variables';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

export interface TemplateDraft {
  templateId: string;
  values: Record<string, string>;
}

function extractUsedVariableNames(selected?: MessagingTemplateCatalogItem): Set<string> {
  if (!selected) return new Set<string>();
  const headerText = selected.header?.kind === 'TEXT' ? selected.header.text : undefined;
  const buttonUrls = (selected.buttons ?? []).map((b) => (b.kind === 'URL' ? b.url : undefined));
  return usedVariableNames(selected.body, headerText, selected.footer ?? undefined, ...buttonUrls);
}

function findSystemLinks(selected?: MessagingTemplateCatalogItem): string[] {
  if (!selected?.buttons) return [];
  return selected.buttons
    .filter((b) => b.kind === 'URL' && Boolean(b.slot))
    .map((b) => String(b.slot));
}

function getTemplateValidationState({
  selected,
  types,
  reserved,
  values,
}: {
  selected?: MessagingTemplateCatalogItem;
  types: MessagingTemplateType[];
  reserved: ReservedVariable[];
  values: Record<string, string>;
}) {
  const reservedNames = new Set(reserved.map((r) => r.name));
  const callerProvidedNames = new Set(reserved.filter((r) => r.callerProvided).map((r) => r.name));
  const allVariables = types.find((type) => type.id === selected?.typeId)?.variables ?? [];
  const variables = allVariables.filter((v) => !reservedNames.has(v.name));

  const usedInSelected = extractUsedVariableNames(selected);
  const blockedNames = [...usedInSelected].filter((name) => callerProvidedNames.has(name));
  const systemLinks = findSystemLinks(selected);
  const blocked = blockedNames.length > 0 || systemLinks.length > 0;

  const valid =
    Boolean(selected) &&
    !blocked &&
    variables.every((v) => v.required === false || Boolean(values[v.name]?.trim()));

  return { variables, blockedNames, systemLinks, valid };
}

function TemplateSelectPicker({
  available,
  templateId,
  onPick,
  t,
}: {
  available: MessagingTemplateCatalogItem[];
  templateId: string;
  onPick: (id: string) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="template-pick">{t('pickTemplate')}</Label>
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTemplatesAvailable')}</p>
      ) : (
        <Select value={templateId} onValueChange={onPick}>
          <SelectTrigger id="template-pick" className="w-full">
            <SelectValue placeholder={t('pickTemplate')} />
          </SelectTrigger>
          <SelectContent>
            {available.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.key} ({candidate.language})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function TemplateBlockedAlerts({
  blockedNames,
  systemLinks,
  t,
}: {
  blockedNames: string[];
  systemLinks: string[];
  t: TranslateFn;
}) {
  return (
    <>
      {blockedNames.length > 0 && (
        <p className="text-sm text-destructive">
          {t('templateBlockedCallerProvided', { names: blockedNames.join(', ') })}
        </p>
      )}
      {systemLinks.length > 0 && (
        <p className="text-sm text-destructive">
          {t('templateBlockedSystemLink', { names: systemLinks.join(', ') })}
        </p>
      )}
    </>
  );
}

function TemplateVariableFields({
  variables,
  values,
  onChange,
  t,
}: {
  variables: TemplateVariable[];
  values: Record<string, string>;
  onChange: (name: string, val: string) => void;
  t: TranslateFn;
}) {
  return (
    <>
      {variables.map((variable) => (
        <div key={variable.name} className="grid gap-2">
          <Label htmlFor={`template-var-${variable.name}`}>
            {variable.name}
            {variable.required === false ? ` (${t('variableDefault')}: ${variable.default})` : ''}
          </Label>
          <Input
            id={`template-var-${variable.name}`}
            value={values[variable.name] ?? ''}
            onChange={(event) => onChange(variable.name, event.target.value)}
          />
        </div>
      ))}
    </>
  );
}

/** Lista o catálogo da conexão (só APPROVED quando o provider exige aprovação) e monta o form das variáveis. */
export function MessageTemplateDialog({
  open,
  onOpenChange,
  connectionId,
  template,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  template: MessagingCapabilities['template'];
  pending: boolean;
  onSubmit: (draft: TemplateDraft) => void;
}) {
  const { t } = useTranslation('messaging');
  const { data: templatesPage } = useTemplatesForConnection(connectionId);
  const { data: typesPage } = useTemplateTypes({ pagination: false } as never);
  const { data: reservedData } = useTemplateVariables();
  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const templates: MessagingTemplateCatalogItem[] = Array.isArray(templatesPage)
    ? templatesPage
    : templatesPage?.data ?? [];
  const types: MessagingTemplateType[] = Array.isArray(typesPage)
    ? typesPage
    : typesPage?.data ?? [];
  const reserved = reservedData ?? [];

  const available = templates.filter(
    (candidate) =>
      !candidate.invalidReason && (!template.approval || candidate.approvalStatus === 'APPROVED'),
  );
  const selected = available.find((candidate) => candidate.id === templateId);

  const { variables, blockedNames, systemLinks, valid } = getTemplateValidationState({
    selected,
    types,
    reserved,
    values,
  });

  const pick = (id: string) => {
    setTemplateId(id);
    setValues({});
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || !selected) return;
    onSubmit({ templateId: selected.id, values });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('template')}</DialogTitle>
          <DialogDescription>
            {template.approval ? t('templateNative') : t('templateFallback')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <TemplateSelectPicker
            available={available}
            templateId={templateId}
            onPick={pick}
            t={t}
          />

          <TemplateBlockedAlerts
            blockedNames={blockedNames}
            systemLinks={systemLinks}
            t={t}
          />

          <TemplateVariableFields
            variables={variables}
            values={values}
            onChange={(name, val) => setValues((curr) => ({ ...curr, [name]: val }))}
            t={t}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {t('send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
