'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  RichTextInput,
  type RichTextVariableOption,
} from '@/components/rich-text-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { usePageSources } from '@/lib/actions/pageBuilder/queries';
import { useUploadProposalArtifact } from '@/lib/actions/proposal/queries';
import { useStorageHealth } from '@/lib/actions/user/queries';
import type { PageSourceDto } from '@/lib/generated/schemas';
import {
  BLOCK_META,
  canAcceptChildrenType,
  isInlineBlockType,
  type BlockPropMeta,
  type BlockType,
} from '../blocks.meta';
import { classNamesFor } from '../class-names';
import { getMaxResizeBounds } from '../grid-engine';
import { LAYOUT_PROFILES } from '../profiles';
import {
  QUICK_HEIGHTS,
  QUICK_WIDTHS,
  minRowSpanForType,
  normalizeRowSpan,
  normalizeSpan,
} from '../schema';
import { useEditorOrThrow } from './context';

/** Painel de propriedades do bloco selecionado, gerado a partir de BLOCK_META. */
export function EditorPanel({
  pageKey,
  dirty,
  saving,
  onSave,
  onSaveAsDefault,
  onCancel,
}: {
  pageKey: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  /** Só ADMIN recebe: publica o layout como padrão de quem não tem o próprio. */
  onSaveAsDefault?: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const { data: sources = [], isLoading } = usePageSources();

  return (
    <aside className="bg-background fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l shadow-lg">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{t('editor.title')}</p>
          <p className="text-muted-foreground truncate text-xs">{pageKey}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label={t('editor.close')}>
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Palette />
        <Separator />
        {editor.selected ? (
          <BlockForm sources={sources} sourcesLoading={isLoading} />
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {t('editor.nothingSelected')}
          </p>
        )}
      </div>

      <footer className="space-y-2 border-t p-4">
        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={!dirty || saving} className="flex-1">
            {saving ? t('editor.saving') : t('editor.save')}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {t('editor.cancel')}
          </Button>
        </div>
        {onSaveAsDefault ? (
          <>
            <Button
              variant="secondary"
              className="w-full"
              onClick={onSaveAsDefault}
              disabled={saving}
              title={t('editor.saveAsDefaultHint')}
            >
              {t('editor.saveAsDefault')}
            </Button>
            <p className="text-muted-foreground text-xs">
              {t('editor.saveAsDefaultHint')}
            </p>
          </>
        ) : null}
      </footer>
    </aside>
  );
}

/** Adicionar bloco — no container selecionado, se houver um; senão no topo da página. */
function Palette() {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();

  // Container selecionado: entra nele. Filho selecionado: entra no MESMO container — senão
  // o bloco seguinte nasceria na raiz, porque `add` move a seleção para o recém-criado.
  const selected = editor.selected;
  const target = selected
    ? isContainer(selected.block.type) && !selected.parentId
      ? selected.block.id
      : selected.parentId
    : undefined;

  // Quando um bloco de topo não-container (ex: Gráfico, Card, Tabela) está selecionado,
  // micro-elementos (Texto, Botão) entram dentro dele; blocos normais vão para a página.
  const inlineParentTarget = selected
    ? !selected.parentId && canAcceptChildrenType(selected.block.type)
      ? selected.block.id
      : selected.parentId
    : undefined;

  const full = !editor.canAddTo(target);
  const blockTypes = (Object.keys(BLOCK_META) as BlockType[]).filter((type) =>
    (LAYOUT_PROFILES[editor.profile].blocks as readonly string[]).includes(type),
  );

  return (
    <section className="space-y-2">
      <Label className="text-xs font-semibold uppercase">
        {target ? t('editor.addToContainer') : t('editor.addBlock')}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {blockTypes.map((type) => {
          const blockLabel = t(`blocks.${type}`, { defaultValue: type });
          const effectiveTarget = isInlineBlockType(type) ? inlineParentTarget : target;
          const canAddThis = editor.canAddTo(effectiveTarget);
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              className="justify-start"
              // Container dentro de container é recusado na escrita — nem oferecer.
              disabled={!canAddThis || (!!effectiveTarget && isContainer(type))}
              title={BLOCK_META[type].description}
              onClick={() => editor.add(type, effectiveTarget)}
            >
              <Plus className="size-3.5" />
              <span className="truncate">{blockLabel}</span>
              <span className="sr-only">{type}</span>
            </Button>
          );
        })}
      </div>
      {full ? (
        <p className="text-muted-foreground text-xs">{t('editor.limitReached')}</p>
      ) : null}
    </section>
  );
}

function BlockForm({
  sources,
  sourcesLoading,
}: {
  sources: PageSourceDto[];
  sourcesLoading: boolean;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const { block } = editor.selected!;
  const meta = BLOCK_META[block.type as BlockType];

  if (!meta) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('editor.unknownType', { type: block.type })}
      </p>
    );
  }

  // Filtra as fontes compatíveis com o tipo de dado que este bloco aceita.
  const compatible = sources.filter((s) =>
    (meta.accepts as readonly string[]).includes(s.kind),
  );
  const source = sources.find((s) => s.key === block.data?.source);
  const isOptionalSource = 'optionalSource' in meta && !!meta.optionalSource;
  const availableVariables = buildVariableOptions(source);
  const parentId = editor.selected?.parentId;
  const siblingList = parentId
    ? (editor.draft.blocks.find((b) => b.id === parentId)?.children ?? [])
    : editor.draft.blocks;
  const { maxSpan, maxRowSpan } = getMaxResizeBounds(siblingList, block.id);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold">{t(`blocks.${block.type}`, { defaultValue: block.type })}</p>
        <p className="text-muted-foreground text-xs">{meta.description}</p>
      </div>

      {meta.accepts.length > 0 ? (
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.dataSource')}</Label>
          <Select
            value={block.data?.source ?? ''}
            onValueChange={(v) => editor.setSource(block.id, v)}
            disabled={sourcesLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('editor.pickSource')} />
            </SelectTrigger>
            <SelectContent>
              {compatible.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isOptionalSource && block.data?.source ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-[11px] underline"
              onClick={() => editor.setSource(block.id, undefined)}
            >
              {t('editor.clearSource')}
            </button>
          ) : null}
          {source ? (
            <p className="text-muted-foreground text-xs">{source.description}</p>
          ) : isOptionalSource ? (
            <p className="text-muted-foreground text-xs">
              {t('editor.optionalSourceHint')}
            </p>
          ) : (
            <p className="text-destructive text-xs">{t('editor.sourceRequired')}</p>
          )}
        </div>
      ) : null}

      {meta.props.map((prop) =>
        block.type === 'iframe' && prop.name === 'storageKey' ? (
          <ArtifactStorageKeyField
            key={prop.name}
            value={block.props?.[prop.name]}
            onChange={(v) => editor.setProp(block.id, prop.name, v)}
          />
        ) : (
          <PropField
            key={prop.name}
            meta={prop}
            value={block.props?.[prop.name]}
            fields={source?.fields ?? []}
            variables={availableVariables}
            onChange={(v) => editor.setProp(block.id, prop.name, v)}
          />
        ),
      )}

      {source?.params.length ? (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase">
            {t('editor.parameters')}
          </Label>
          {source.params.map((param) => (
            <div key={param.name} className="space-y-1.5">
              <Label className="text-xs">{param.name}</Label>
              <Input
                type={param.type === 'number' ? 'number' : 'text'}
                value={String(block.data?.params?.[param.name] ?? '')}
                onChange={(e) =>
                  editor.setParam(
                    block.id,
                    param.name,
                    param.type === 'number' && e.target.value !== ''
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
              <p className="text-muted-foreground text-xs">{param.description}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('editor.width', { defaultValue: 'Largura do Bloco' })}</Label>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {normalizeSpan(block.span)} / 12 colunas
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {QUICK_WIDTHS.filter((w) => [3, 4, 6, 8, 12].includes(w.span)).map((w) => (
            <Button
              key={w.span}
              type="button"
              variant={normalizeSpan(block.span) === w.span ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-1 text-xs"
              disabled={w.span > maxSpan}
              title={
                w.span > maxSpan
                  ? t('editor.widthBlockedByNeighbor', {
                      defaultValue: 'Sem espaço livre ao lado nesta linha',
                    })
                  : w.label
              }
              onClick={() => editor.setSpan(block.id, w.span)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('editor.height', { defaultValue: 'Altura (Linhas)' })}</Label>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {normalizeRowSpan(block.rowSpan, block.type)}{' '}
            {normalizeRowSpan(block.rowSpan, block.type) === 1 ? 'linha' : 'linhas'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {QUICK_HEIGHTS.map((h) => {
            const minRowSpan = minRowSpanForType(block.type);
            const disabledOption = h.rowSpan > maxRowSpan || h.rowSpan < minRowSpan;
            return (
              <Button
                key={h.rowSpan}
                type="button"
                variant={
                  normalizeRowSpan(block.rowSpan, block.type) === h.rowSpan
                    ? 'default'
                    : 'outline'
                }
                size="sm"
                className="h-7 px-1 text-xs"
                disabled={disabledOption}
                title={
                  h.rowSpan > maxRowSpan
                    ? t('editor.heightBlockedByNeighbor', {
                        defaultValue: 'Sem espaço livre abaixo deste bloco',
                      })
                    : h.label
                }
                onClick={() => editor.setRowSpan(block.id, h.rowSpan)}
              >
                {h.label}
              </Button>
            );
          })}
        </div>
      </div>

      <ClassNamePicker
        value={block.className}
        onChange={(v) => editor.patch(block.id, { className: v })}
      />
    </section>
  );
}

function ContentRichField({
  label,
  value,
  metaName,
  compact,
  variables,
  onChange,
}: {
  label: React.ReactNode;
  value: unknown;
  metaName: string;
  compact?: boolean;
  variables?: RichTextVariableOption[];
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation('page-builder');
  return (
    <div className="space-y-1.5">
      {label}
      <RichTextInput
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(text) => onChange(text)}
        placeholder={t('editor.contentPlaceholder', { defaultValue: 'Digite o conteúdo...' })}
        ariaLabel={metaName}
        variables={variables}
        variableButtonLabel={t('editor.insertVariable')}
        formatLabels={{
          bold: t('editor.formatBold', { defaultValue: 'Negrito (*texto*)' }),
          italic: t('editor.formatItalic', { defaultValue: 'Itálico (_texto_)' }),
          strikethrough: t('editor.formatStrikethrough', { defaultValue: 'Riscado (~texto~)' }),
          code: t('editor.formatCode', { defaultValue: 'Código (```texto```)' }),
        }}
        className={compact ? 'min-h-14' : 'min-h-24'}
      />
    </div>
  );
}

const RICH_TEXT_PROP_NAMES = new Set([
  'content',
  'label',
  'hint',
  'title',
  'description',
]);

/** Campo de `storageKey` do bloco `iframe`: sobe o arquivo em vez de pedir a chave como texto —
 * o conteúdo nunca mora no layout (ver docs/frontend/page-builder.md). Desabilita com motivo
 * visível quando o storage está fora do ar ([[service-health-gate]]) ou a proposta ainda não
 * existe (`editor.recordId` ausente — rascunho novo que ainda não foi salvo). */
function ArtifactStorageKeyField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation('page-builder');
  const editor = useEditorOrThrow();
  const { data: health } = useStorageHealth();
  const upload = useUploadProposalArtifact();
  const recordId = editor.recordId;
  const storageDisabled = health?.operational === false;
  const isDisabled = !recordId || storageDisabled || upload.isPending;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !recordId) return;
    upload.mutate(
      { proposalId: recordId, file },
      { onSuccess: (artifact) => onChange(artifact.storageKey) },
    );
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {t('editor.artifactUpload')}
        <span className="text-destructive">*</span>
      </Label>
      {typeof value === 'string' && value ? (
        <p className="text-muted-foreground truncate text-xs" title={value}>
          {value}
        </p>
      ) : null}
      <Input
        type="file"
        accept=".html,image/png,image/jpeg,image/svg+xml,image/webp"
        disabled={isDisabled}
        onChange={handleFile}
      />
      {!recordId ? (
        <p className="text-muted-foreground text-xs">
          {t('editor.artifactMissingRecord', {
            defaultValue: 'Salve a proposta antes de enviar o artefato.',
          })}
        </p>
      ) : storageDisabled ? (
        <p className="text-destructive text-xs">
          {t('editor.artifactStorageDisabled')}
        </p>
      ) : upload.isPending ? (
        <p className="text-muted-foreground text-xs">
          {t('editor.artifactUploading')}
        </p>
      ) : upload.isError ? (
        <p className="text-destructive text-xs">
          {t('editor.artifactUploadError')}
        </p>
      ) : null}
    </div>
  );
}

/** Um campo por entrada de `BlockPropMeta` — o `type` da meta decide o controle. */
function PropField({
  meta,
  value,
  fields,
  variables,
  onChange,
}: {
  meta: BlockPropMeta;
  value: unknown;
  /** Campos que a fonte escolhida devolve; alimenta as props do tipo `string[]`. */
  fields: string[];
  /** Variáveis disponíveis na fonte de dados para interpolação `{{var}}` em RichTextInput. */
  variables?: RichTextVariableOption[];
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation('page-builder');
  const label = (
    <Label className="text-xs">
      {meta.name}
      {meta.required ? <span className="text-destructive">*</span> : null}
    </Label>
  );

  if (meta.type === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        {label}
        <Switch checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }

  if (meta.type === 'string' && RICH_TEXT_PROP_NAMES.has(meta.name)) {
    return (
      <ContentRichField
        label={label}
        value={value}
        metaName={meta.name}
        compact={meta.name !== 'content'}
        variables={variables}
        onChange={onChange}
      />
    );
  }

  if (meta.type === 'string[]') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    // Com fonte escolhida, oferece os campos REAIS: é o que impede a coluna vazia por nome
    // de campo inventado, que hoje só o texto da description do bloco tenta evitar.
    if (fields.length) {
      return (
        <div className="space-y-1.5">
          {label}
          <div className="space-y-1.5 rounded-md border p-2">
            {fields.map((field) => (
              <label key={field} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(field)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, field]
                        : selected.filter((f) => f !== field),
                    )
                  }
                />
                {field}
              </label>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        {label}
        <Input
          value={selected.join(', ')}
          placeholder={t('editor.pickSourceFirst')}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label}
      <Input
        type={meta.type === 'number' ? 'number' : 'text'}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) =>
          onChange(
            meta.type === 'number' && e.target.value !== ''
              ? Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </div>
  );
}

/** Estilo é vocabulário fechado (`classNamesFor(profile)`): select adiciona, chip remove. */
function ClassNamePicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const { t } = useTranslation('page-builder');
  const { profile } = useEditorOrThrow();
  const current = value?.split(/\s+/).filter(Boolean) ?? [];
  const set = (next: string[]) => onChange(next.length ? next.join(' ') : undefined);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{t('editor.style')}</Label>
      {current.length ? (
        <div className="flex flex-wrap gap-1">
          {current.map((cls) => (
            <Badge key={cls} variant="secondary" className="gap-1">
              {cls}
              <button
                type="button"
                aria-label={t('editor.removeClass', { class: cls })}
                onClick={() => set(current.filter((c) => c !== cls))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Select value="" onValueChange={(v) => !current.includes(v) && set([...current, v])}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('editor.addClass')} />
        </SelectTrigger>
        <SelectContent>
          {classNamesFor(profile)
            .filter((c) => !current.includes(c))
            .map((cls) => (
              <SelectItem key={cls} value={cls}>
                {cls}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function isContainer(type: string): boolean {
  const meta = BLOCK_META[type as BlockType];
  return !!meta && 'container' in meta && meta.container;
}

/** Constrói a lista de variáveis `{{var}}` disponíveis a partir da fonte de dados selecionada. */
function buildVariableOptions(
  source: PageSourceDto | undefined,
): RichTextVariableOption[] {
  if (!source) return [];
  const options: RichTextVariableOption[] = [];

  if (source.kind === 'list' || source.kind === 'count') {
    options.push({
      token: 'total',
      label: 'Total de registros',
      description: 'Quantidade total retornada pela fonte',
    });
  }

  if (source.kind === 'series') {
    options.push(
      {
        token: 'value',
        label: 'Último valor da série',
        description: 'Valor mais recente da série temporal',
      },
      {
        token: 'date',
        label: 'Última data da série',
        description: 'Data do registro mais recente',
      },
    );
  }

  for (const field of source.fields ?? []) {
    if (field === 'total') continue;
    options.push({
      token: field,
      label: `Campo: ${field}`,
      description: `Valor do campo "${field}" do primeiro item`,
    });
  }

  return options;
}
