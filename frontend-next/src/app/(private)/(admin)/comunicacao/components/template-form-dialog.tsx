'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { usedVariableNames } from '@/lib/messaging/template-variables';
import { VariableInputRow } from './variable-input-row';
import { TemplateButtonsEditor, draftsFrom, type ButtonDraft } from './template-buttons-editor';
import { MetaRulesPanel } from './meta-rules-panel';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  categoryAllowsButtons,
  rebaseOnSlots,
  slotsOf,
  toPayload,
  validateButton,
  withRequiredSlots,
} from '@/lib/messaging/template-buttons';
import { TemplateBodyEditor } from './template-body-editor';
import { getReservedDummyValue } from '@/lib/messaging/reserved-variables';
import { WhatsappSimulator } from './template-preview';
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
  useCreateTemplate,
  useUpdateTemplate,
  useTemplateVariables,
  useNativeButtonsSupport,
  useTemplateButtons,
  useMetaTemplateCheck,
} from '@/lib/actions/messaging/queries';
import type {
  MessagingTemplateCatalogItem,
  MessagingTemplateCategory,
  MessagingTemplateType,
  TemplateVariable,
  ReservedVariable,
  TemplateButton,
} from '@/lib/actions/messaging/types';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

/** `min-w-0` encolhe a célula do Select para truncar valores longos em vez de estourar o grid. */
const SELECT_FIT =
  'w-full min-w-0 *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate';

const CATEGORIES: MessagingTemplateCategory[] = ['AUTHENTICATION', 'UTILITY', 'MARKETING'];
const LANGUAGES = ['pt-BR', 'en'];

function replaceTemplateVariables(
  text: string,
  reserved: ReservedVariable[],
  variables: TemplateVariable[],
) {
  if (!text) return text;
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, varName) => {
    const name = varName.trim();
    const reservedVar = reserved.find((v) => v.name === name);
    if (reservedVar) {
      return getReservedDummyValue(reservedVar);
    }
    const tpl = variables.find((v) => v.name === name);
    if (tpl) return tpl.default || `[${name}]`;
    return `[${name}]`;
  });
}

function checkCanSaveTemplate({
  typeId,
  key,
  language,
  category,
  body,
  buttonsValid,
  missingRequiredCount,
  isPending,
}: {
  typeId: string;
  key: string;
  language: string;
  category: string;
  body: string;
  buttonsValid: boolean;
  missingRequiredCount: number;
  isPending: boolean;
}) {
  return (
    Boolean(typeId) &&
    Boolean(key.trim()) &&
    Boolean(language) &&
    Boolean(category) &&
    Boolean(body.trim()) &&
    body.length <= 1024 &&
    buttonsValid &&
    missingRequiredCount === 0 &&
    !isPending
  );
}

async function updateExistingTemplateDraft({
  editing,
  category,
  trimmedBody,
  trimmedHeader,
  trimmedFooter,
  buttonsPayload,
  bypassOptOut,
  updateTemplate,
  onUpdated,
}: {
  editing: MessagingTemplateCatalogItem;
  category: MessagingTemplateCategory;
  trimmedBody: string;
  trimmedHeader: string;
  trimmedFooter: string;
  buttonsPayload?: ReturnType<typeof toPayload>;
  bypassOptOut: boolean;
  updateTemplate: ReturnType<typeof useUpdateTemplate>;
  onUpdated?: (template: MessagingTemplateCatalogItem) => void;
}) {
  const payload = {
    category,
    body: trimmedBody,
    header: trimmedHeader ? ({ kind: 'TEXT', text: trimmedHeader } as const) : null,
    footer: trimmedFooter || null,
    buttons: buttonsPayload ?? null,
    bypassOptOut,
  };
  await updateTemplate.mutateAsync({ id: editing.id, payload });
  const sameContent =
    JSON.stringify([editing.category, editing.body, editing.header ?? null, editing.footer ?? null, editing.buttons ?? null]) ===
    JSON.stringify([payload.category, payload.body, payload.header, payload.footer, payload.buttons]);
  if (!sameContent) onUpdated?.(editing);
}

async function saveTemplateDraft({
  editing,
  category,
  body,
  headerText,
  footer,
  activeButtons,
  bypassOptOut,
  typeId,
  key,
  language,
  createTemplate,
  updateTemplate,
  onUpdated,
}: {
  editing: MessagingTemplateCatalogItem | null;
  category: MessagingTemplateCategory;
  body: string;
  headerText: string;
  footer: string;
  activeButtons: TemplateButton[];
  bypassOptOut: boolean;
  typeId: string;
  key: string;
  language: string;
  createTemplate: ReturnType<typeof useCreateTemplate>;
  updateTemplate: ReturnType<typeof useUpdateTemplate>;
  onUpdated?: (template: MessagingTemplateCatalogItem) => void;
}) {
  const buttonsPayload = activeButtons.length > 0 ? toPayload(activeButtons) : undefined;
  const trimmedBody = body.trim();
  const trimmedHeader = headerText.trim();
  const trimmedFooter = footer.trim();

  if (editing) {
    return updateExistingTemplateDraft({
      editing,
      category,
      trimmedBody,
      trimmedHeader,
      trimmedFooter,
      buttonsPayload,
      bypassOptOut,
      updateTemplate,
      onUpdated,
    });
  }

  await createTemplate.mutateAsync({
    typeId,
    key: key.trim(),
    language,
    category,
    body: trimmedBody,
    header: trimmedHeader ? { kind: 'TEXT', text: trimmedHeader } : undefined,
    footer: trimmedFooter || undefined,
    buttons: buttonsPayload,
    bypassOptOut,
  });
}

function TemplateMetadataFields({
  types,
  typeId,
  key,
  language,
  category,
  editing,
  hasSubmitted,
  onTypeChange,
  onKeyChange,
  onLanguageChange,
  onCategoryChange,
  t,
  tCommon,
  tLabel,
}: {
  types: MessagingTemplateType[];
  typeId: string;
  key: string;
  language: string;
  category: MessagingTemplateCategory;
  editing: MessagingTemplateCatalogItem | null;
  hasSubmitted: boolean;
  onTypeChange: (id: string) => void;
  onKeyChange: (key: string) => void;
  onLanguageChange: (lang: string) => void;
  onCategoryChange: (cat: MessagingTemplateCategory) => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  tLabel: (key: string) => string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <Label>{t('templateTypeLabel')}</Label>
          <Select value={typeId} onValueChange={onTypeChange} disabled={Boolean(editing)}>
            <SelectTrigger className={SELECT_FIT}>
              <SelectValue placeholder={t('templateTypeLabel')} />
            </SelectTrigger>
            <SelectContent>
              {types.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {`${type.key} — ${type.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasSubmitted && !typeId && <p className="text-[0.8rem] text-destructive">{tCommon('validation_required')}</p>}
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label>{t('typeKey')}</Label>
          <Input
            value={key}
            maxLength={100}
            disabled={Boolean(editing)}
            onChange={(e) => onKeyChange(e.target.value)}
          />
          {hasSubmitted && !key.trim() && <p className="text-[0.8rem] text-destructive">{tCommon('validation_required')}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t('templateLanguage')}</Label>
          <Select value={language} onValueChange={onLanguageChange} disabled={Boolean(editing)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {tLabel(lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasSubmitted && !language && <p className="text-[0.8rem] text-destructive">{tCommon('validation_required')}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label>{t('templateCategory')}</Label>
          <Select
            value={category}
            onValueChange={(v) => onCategoryChange(v as MessagingTemplateCategory)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasSubmitted && !category && <p className="text-[0.8rem] text-destructive">{tCommon('validation_required')}</p>}
        </div>
      </div>
    </>
  );
}

function TemplateBodyField({
  body,
  onBodyChange,
  variables,
  reserved,
  usedNames,
  hasSubmitted,
  t,
  tCommon,
}: {
  body: string;
  onBodyChange: (b: string) => void;
  variables: TemplateVariable[];
  reserved: ReservedVariable[];
  usedNames: Set<string>;
  hasSubmitted: boolean;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  return (
    <div className="grid gap-1">
      <TemplateBodyEditor
        label={t('templateBody')}
        initialValue={body}
        onChange={onBodyChange}
        variables={variables}
        reserved={reserved}
        usedNames={usedNames}
      />
      {hasSubmitted && !body.trim() && (
        <p className="text-[0.8rem] text-destructive">{tCommon('validation_required')}</p>
      )}
      <p
        className={`text-right text-xs ${body.length > 1024 ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {body.length}/1024
      </p>
    </div>
  );
}

function TemplateSimulatorSection({
  headerText,
  body,
  footer,
  activeButtons,
  reserved,
  variables,
  previewLabel,
}: {
  headerText: string;
  body: string;
  footer: string;
  activeButtons: TemplateButton[];
  reserved: ReservedVariable[];
  variables: TemplateVariable[];
  previewLabel: string;
}) {
  const replace = (text: string) => replaceTemplateVariables(text, reserved, variables);

  return (
    <div className="hidden lg:flex flex-col space-y-4 sticky top-0 min-h-[400px]">
      <h3 className="text-xs font-semibold text-muted-foreground w-full text-center uppercase tracking-wider">
        {previewLabel}
      </h3>
      <WhatsappSimulator
        headerText={headerText ? replace(headerText) : undefined}
        body={replace(body)}
        footer={footer ? replace(footer) : undefined}
        buttons={activeButtons.map((b) => ({ kind: b.kind, label: replace(b.label) }))}
      />
    </div>
  );
}

function getInitialFormValues(editing: MessagingTemplateCatalogItem | null) {
  if (!editing) {
    return {
      typeId: '',
      key: '',
      keyTouched: false,
      language: 'pt-BR',
      category: 'UTILITY' as MessagingTemplateCategory,
      headerText: '',
      body: '',
      footer: '',
      bypassOptOut: false,
    };
  }
  const headerText = editing.header?.kind === 'TEXT' ? editing.header.text : '';
  return {
    typeId: editing.typeId,
    key: editing.key,
    keyTouched: true,
    language: editing.language,
    category: editing.category,
    headerText,
    body: editing.body,
    footer: editing.footer ?? '',
    bypassOptOut: editing.bypassOptOut,
  };
}

function getInitialButtonDrafts(
  editing: MessagingTemplateCatalogItem | null,
  types: MessagingTemplateType[],
): ButtonDraft[] {
  if (!editing) return [];
  const type = types.find((ty) => ty.id === editing.typeId);
  const required = slotsOf(type?.buttons?.filter((b) => !b.reserved), []);
  return draftsFrom(withRequiredSlots(editing.buttons ?? [], required));
}

function useTemplateDerivedData({
  types,
  typeId,
  category,
  buttonDrafts,
  headerText,
  body,
  footer,
}: {
  types: MessagingTemplateType[];
  typeId: string;
  category: MessagingTemplateCategory;
  buttonDrafts: ButtonDraft[];
  headerText: string;
  body: string;
  footer: string;
}) {
  const { data: reservedData } = useTemplateVariables();
  const { data: buttonsInfo } = useTemplateButtons();

  const selectedType = types.find((ty) => ty.id === typeId);
  const buttonSlots = useMemo(
    () => slotsOf(selectedType?.buttons, buttonsInfo?.reserved ?? []),
    [selectedType, buttonsInfo],
  );
  const typeVariables = selectedType?.variables ?? [];
  const variables = typeVariables.filter((v) => !v.reserved);
  const allowedNames = new Set(typeVariables.filter((v) => v.reserved).map((v) => v.name));
  const reserved = (reservedData ?? []).filter((v) => allowedNames.has(v.name));

  const buttonsAllowed = categoryAllowsButtons(category);
  const activeButtons = useMemo(
    () => (buttonsAllowed ? buttonDrafts.map((d) => d.button) : []),
    [buttonsAllowed, buttonDrafts],
  );
  const buttonUrls = activeButtons.map((b) => (b.kind === 'URL' ? b.url : '')).join('\n');
  const usedNames = useMemo(
    () => usedVariableNames(headerText, body, footer, buttonUrls),
    [headerText, body, footer, buttonUrls],
  );
  const buttonsValid = activeButtons.every((b) => validateButton(b) === null);
  const missingRequired = variables
    .filter((v) => v.required && !usedNames.has(v.name))
    .map((v) => v.name);

  return {
    buttonSlots,
    variables,
    reserved,
    activeButtons,
    usedNames,
    buttonsValid,
    missingRequired,
    buttonsInfo,
  };
}

function useTemplateMetaIssues(
  category: MessagingTemplateCategory,
  body: string,
  headerText: string,
  footer: string,
  activeButtons: TemplateButton[],
  approval: boolean,
) {
  const metaDraft = useDebouncedValue(
    useMemo(
      () => ({
        category,
        body,
        header: headerText.trim() ? ({ kind: 'TEXT', text: headerText } as const) : null,
        footer: footer || null,
        buttons: activeButtons.length > 0 ? activeButtons : null,
      }),
      [category, body, headerText, footer, activeButtons],
    ),
    500,
  );
  return useMetaTemplateCheck(metaDraft, approval);
}

function useTemplateFormState({
  types,
  editing,
  onOpenChange,
  onUpdated,
}: {
  types: MessagingTemplateType[];
  editing: MessagingTemplateCatalogItem | null;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (template: MessagingTemplateCatalogItem) => void;
}) {
  const { t: tCommon } = useTranslation('common');
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const nativeButtons = useNativeButtonsSupport();

  const initial = useMemo(() => getInitialFormValues(editing), [editing]);
  const [typeId, setTypeId] = useState(initial.typeId);
  const [key, setKey] = useState(initial.key);
  const [keyTouched, setKeyTouched] = useState(initial.keyTouched);
  const [language, setLanguage] = useState(initial.language);
  const [category, setCategory] = useState<MessagingTemplateCategory>(initial.category);
  const [headerText, setHeaderText] = useState(initial.headerText);
  const [body, setBody] = useState(initial.body);
  const [footer, setFooter] = useState(initial.footer);
  const [buttonDrafts, setButtonDrafts] = useState<ButtonDraft[]>(() =>
    getInitialButtonDrafts(editing, types),
  );
  const [bypassOptOut, setBypassOptOut] = useState(initial.bypassOptOut);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const derived = useTemplateDerivedData({
    types,
    typeId,
    category,
    buttonDrafts,
    headerText,
    body,
    footer,
  });

  const { issues: metaIssues } = useTemplateMetaIssues(
    category,
    body,
    headerText,
    footer,
    derived.activeButtons,
    nativeButtons.approval,
  );

  const canSave = checkCanSaveTemplate({
    typeId,
    key,
    language,
    category,
    body,
    buttonsValid: derived.buttonsValid,
    missingRequiredCount: derived.missingRequired.length,
    isPending: createTemplate.isPending || updateTemplate.isPending,
  });

  const handleTypeChange = (id: string) => {
    setTypeId(id);
    const picked = types.find((ty) => ty.id === id);
    if (!editing && !keyTouched && picked) setKey(picked.key);
    setButtonDrafts((current) =>
      draftsFrom(
        rebaseOnSlots(
          current.map((d) => d.button),
          slotsOf(picked?.buttons, derived.buttonsInfo?.reserved ?? []),
        ),
      ),
    );
  };

  const handleSubmit = async () => {
    setHasSubmitted(true);
    if (!canSave) return;

    try {
      await saveTemplateDraft({
        editing,
        category,
        body,
        headerText,
        footer,
        activeButtons: derived.activeButtons,
        bypassOptOut,
        typeId,
        key,
        language,
        createTemplate,
        updateTemplate,
        onUpdated,
      });
      toast.success(editing ? tCommon('updatedSuccessfully') : tCommon('successMessage'));
      onOpenChange(false);
    } catch {
      // Handled by collector
    }
  };

  return {
    typeId,
    key,
    setKey,
    setKeyTouched,
    language,
    setLanguage,
    category,
    setCategory,
    headerText,
    setHeaderText,
    body,
    setBody,
    footer,
    setFooter,
    buttonDrafts,
    setButtonDrafts,
    bypassOptOut,
    setBypassOptOut,
    hasSubmitted,
    buttonSlots: derived.buttonSlots,
    variables: derived.variables,
    reserved: derived.reserved,
    activeButtons: derived.activeButtons,
    usedNames: derived.usedNames,
    metaIssues,
    missingRequired: derived.missingRequired,
    isPending: createTemplate.isPending || updateTemplate.isPending,
    nativeButtons,
    handleTypeChange,
    handleSubmit,
  };
}

function TemplateFormFields({
  types,
  state,
  editing,
  t,
  tCommon,
  tLabel,
}: {
  types: MessagingTemplateType[];
  state: ReturnType<typeof useTemplateFormState>;
  editing: MessagingTemplateCatalogItem | null;
  t: TranslateFn;
  tCommon: TranslateFn;
  tLabel: TranslateFn;
}) {
  return (
    <div className="grid gap-4">
      <TemplateMetadataFields
        types={types}
        typeId={state.typeId}
        key={state.key}
        language={state.language}
        category={state.category}
        editing={editing}
        hasSubmitted={state.hasSubmitted}
        onTypeChange={state.handleTypeChange}
        onKeyChange={(k) => {
          state.setKey(k);
          state.setKeyTouched(true);
        }}
        onLanguageChange={state.setLanguage}
        onCategoryChange={state.setCategory}
        t={t}
        tCommon={tCommon}
        tLabel={tLabel}
      />

      <VariableInputRow
        label={t('templateHeaderText')}
        value={state.headerText}
        onChange={state.setHeaderText}
        variables={state.variables}
        reserved={state.reserved}
        usedNames={state.usedNames}
        maxLength={60}
      />

      <TemplateBodyField
        body={state.body}
        onBodyChange={state.setBody}
        variables={state.variables}
        reserved={state.reserved}
        usedNames={state.usedNames}
        hasSubmitted={state.hasSubmitted}
        t={t}
        tCommon={tCommon}
      />

      <VariableInputRow
        label={t('templateFooter')}
        value={state.footer}
        onChange={state.setFooter}
        variables={state.variables}
        reserved={state.reserved}
        usedNames={state.usedNames}
        maxLength={60}
      />

      <TemplateButtonsEditor
        category={state.category}
        drafts={state.buttonDrafts}
        onChange={state.setButtonDrafts}
        variables={state.variables}
        reserved={state.reserved}
        usedNames={state.usedNames}
        showErrors={state.hasSubmitted}
        nativeSupported={state.nativeButtons.isLoading || state.nativeButtons.supported}
        slots={state.buttonSlots}
      />

      <MetaRulesPanel issues={state.metaIssues} />

      {state.missingRequired.length > 0 && (
        <p className="text-sm text-destructive">
          {t('requiredVariableMissing', { names: state.missingRequired.join(', ') })}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Checkbox checked={state.bypassOptOut} onCheckedChange={(c) => state.setBypassOptOut(c === true)} />
        <Label className="font-normal">{t('templateBypassOptOut')}</Label>
      </div>
    </div>
  );
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  types,
  editing,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: MessagingTemplateType[];
  onUpdated?: (template: MessagingTemplateCatalogItem) => void;
  editing: MessagingTemplateCatalogItem | null;
}) {
  const { t } = useTranslation('messaging');
  const { t: tCommon } = useTranslation('common');
  const { t: tLabel } = useTranslation('labelKey');
  const state = useTemplateFormState({ types, editing, onOpenChange, onUpdated });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl sm:max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('editTemplate') : t('newTemplate')}</DialogTitle>
          <DialogDescription>{t('templateKeyDescription')}</DialogDescription>
        </DialogHeader>

        {editing?.invalidReason && (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">{t('needsAdjustmentBadge')}</p>
            <p className="text-destructive">{editing.invalidReason}</p>
            <p className="mt-1 text-muted-foreground">{t('needsAdjustmentHelp')}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <TemplateFormFields
            types={types}
            state={state}
            editing={editing}
            t={t}
            tCommon={tCommon}
            tLabel={tLabel}
          />

          <TemplateSimulatorSection
            headerText={state.headerText}
            body={state.body}
            footer={state.footer}
            activeButtons={state.activeButtons}
            reserved={state.reserved}
            variables={state.variables}
            previewLabel={tCommon('preview') || 'Preview'}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" disabled={state.isPending} onClick={state.handleSubmit}>
            {tCommon('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
