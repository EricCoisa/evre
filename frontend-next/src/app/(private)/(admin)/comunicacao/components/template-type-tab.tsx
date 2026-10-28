'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { DataTable } from '@/components/data-table';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SubmitCancelledError } from '@/components/form/form-builder';
import { contractChanged } from '@/lib/messaging/template-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableHead, DataCell } from '@/components/table-utils';
import {
  useTemplateTypes,
  useCreateTemplateType,
  useUpdateTemplateType,
  useRemoveTemplateType,
  useTemplateVariables,
  useTemplateButtons,
} from '@/lib/actions/messaging/queries';
import type {
  MessagingTemplateType,
  ReservedVariable,
  TemplateButtonSlot,
  TemplateVariable,
} from '@/lib/actions/messaging/types';
import type { TFunc } from '@/hooks/use-translation';
import { ButtonSlotsEditor, ReservedButtonsPicker } from './template-type-buttons';
import { buildTemplateTypeSchema } from './template-type-schema';
import { ButtonKindIcon } from './template-buttons-editor';
import { buildTableQueryParams } from '@/lib/table-query-params';

import { useFormContext } from 'react-hook-form';

/** Linhas repetíveis de `{ name, type, required, default? }` — o vocabulário de variáveis do tipo. */
function VariablesEditor({
  t,
  value,
  onChange,
}: {
  t: TFunc;
  value: TemplateVariable[];
  onChange: (value: TemplateVariable[]) => void;
}) {
  const { formState: { errors } } = useFormContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const varsErrors = errors.variables as any;

  // FormBuilder não sabe que um field 'custom' pode querer array como default: sem `values`
  // (criar), ele manda '' (string). Guarda aqui em vez de arriscar o default compartilhado.
  const vars = Array.isArray(value) ? value : [];
  const update = (index: number, patch: Partial<TemplateVariable>) => {
    const next = [...vars];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const add = () => onChange([...vars, { name: '', type: 'STRING', required: true }]);
  const remove = (index: number) => onChange(vars.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {vars.map((variable, index) => {
        const errorMsg = varsErrors?.[index]?.name?.message;
        return (
          <div key={index} className="flex flex-col gap-1">
            <div className={`flex flex-wrap items-end gap-2 rounded-md border p-2 ${errorMsg ? 'border-destructive' : ''}`}>
              <div className="grid gap-1">
                <Label className="text-xs">{t('variableName')}</Label>
                <Input
                  className={`w-36 ${errorMsg ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  value={variable.name}
                  placeholder="first_name"
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t('variableType')}</Label>
                <Select
                  value={variable.type}
                  onValueChange={(v) => update(index, { type: v as TemplateVariable['type'] })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STRING">STRING</SelectItem>
                    <SelectItem value="NUMBER">NUMBER</SelectItem>
                    <SelectItem value="DATE">DATE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  checked={variable.required}
                  onCheckedChange={(c) => update(index, { required: c === true })}
                />
                <Label className="text-xs">{t('variableRequired')}</Label>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  checked={!!variable.sensitive}
                  onCheckedChange={(c) => update(index, { sensitive: c === true })}
                />
                <Label className="text-xs">{t('variableSensitive')}</Label>
              </div>
              {!variable.required && (
                <div className="grid gap-1">
                  <Label className="text-xs">{t('variableDefault')}</Label>
                  <Input
                    className="w-28"
                    value={variable.default ?? ''}
                    onChange={(e) => update(index, { default: e.target.value })}
                  />
                </div>
              )}
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(index)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {errorMsg && <p className="text-[0.8rem] font-medium text-destructive">{errorMsg}</p>}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-4" /> {t('addVariable')}
      </Button>
    </div>
  );
}

/** Checkbox por reservada do sistema: só as marcadas ficam disponíveis nos templates do tipo. */
function ReservedVariablesPicker({
  t,
  reserved,
  value,
  onChange,
}: {
  t: TFunc;
  reserved: ReservedVariable[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  // Mesmo motivo do VariablesEditor: em "criar" o FormBuilder entrega '' em vez de array.
  const selected = Array.isArray(value) ? value : [];
  const toggle = (name: string, checked: boolean) =>
    onChange(checked ? [...selected, name] : selected.filter((n) => n !== name));

  if (!reserved.some((v) => v.allowUse)) return null;
  return (
    <div className="space-y-2">
      {reserved.filter((v) => v.allowUse).map((v) => (
        <div key={v.name} className="flex items-center gap-2">
          <Checkbox
            id={`reserved-${v.name}`}
            checked={selected.includes(v.name)}
            onCheckedChange={(c) => toggle(v.name, c === true)}
          />
          <Label htmlFor={`reserved-${v.name}`} className="font-normal">
            <span className="font-mono text-xs">{v.name}</span>
            <span className="ml-2 text-muted-foreground">{t(v.labelKey)}</span>
          </Label>
        </div>
      ))}
    </div>
  );
}

export function TemplateTypeTab() {
  const { t } = useTranslation('messaging');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const queryParams = buildTableQueryParams(pagination, globalFilter, filters);

  const { data, error, isLoading } = useTemplateTypes({
    ...queryParams,
    pagination: true,
  } as never);
  const createType = useCreateTemplateType();
  const updateType = useUpdateTemplateType();
  const removeType = useRemoveTemplateType();
  const { data: reservedData } = useTemplateVariables();
  const reservedList = useMemo(() => reservedData ?? [], [reservedData]);
  const { data: buttonsInfo } = useTemplateButtons();
  const reservedButtons = useMemo(() => buttonsInfo?.reserved ?? [], [buttonsInfo]);
  const handlers = useMemo(() => buttonsInfo?.handlers ?? [], [buttonsInfo]);
  const reservedButtonKeys = useMemo(
    () => new Set(reservedButtons.map((b) => b.key)),
    [reservedButtons],
  );
  const reservedNames = useMemo(
    () => new Set((reservedData ?? []).map((v) => v.name)),
    [reservedData],
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MessagingTemplateType | null>(null);
  const [deleting, setDeleting] = useState<MessagingTemplateType | null>(null);
  // Alterar o contrato de um tipo em uso: espera a pessoa confirmar antes de gravar.
  const [pendingChange, setPendingChange] = useState<((ok: boolean) => void) | null>(null);
  const confirmContractChange = () =>
    new Promise<boolean>((resolve) => setPendingChange(() => resolve));
  const answerContractChange = (ok: boolean) => {
    pendingChange?.(ok);
    setPendingChange(null);
  };

  const schema = useMemo(
    () => buildTemplateTypeSchema(t, reservedNames, reservedButtonKeys),
    [t, reservedNames, reservedButtonKeys],
  );

  const lockedButtonKeys = useMemo(
    () => new Set((editing?.buttons ?? []).filter((b) => !b.reserved).map((b) => b.key)),
    [editing],
  );

  const fields = useMemo<FormBuilderField[]>(
    () => [
      {
        name: 'key',
        label: t('typeKey'),
        disabled: !!editing,
        description: editing ? t('keyImmutable') : undefined,
      },
      { name: 'name', label: t('typeName') },
      {
        name: 'variables',
        label: t('variables'),
        type: 'custom',
        render: (field) => (
          <VariablesEditor
            t={t}
            value={(field.value as TemplateVariable[]) ?? []}
            onChange={field.onChange}
          />
        ),
      },
      {
        name: 'reservedVariables',
        label: t('reservedVariables'),
        description: t('reservedVariablesDescription'),
        type: 'custom',
        render: (field) => (
          <ReservedVariablesPicker
            t={t}
            reserved={reservedList}
            value={(field.value as string[]) ?? []}
            onChange={field.onChange}
          />
        ),
      },
      {
        name: 'buttons',
        label: t('typeButtons'),
        description: t('typeButtonsDescription'),
        type: 'custom',
        render: (field) => (
          <ButtonSlotsEditor
            t={t}
            value={(field.value as TemplateButtonSlot[]) ?? []}
            onChange={field.onChange}
            handlers={handlers}
            lockedKeys={lockedButtonKeys}
          />
        ),
      },
      {
        name: 'reservedButtons',
        label: t('reservedButtons'),
        description: t('reservedButtonsDescription'),
        type: 'custom',
        render: (field) => (
          <ReservedButtonsPicker
            t={t}
            reserved={reservedButtons}
            value={(field.value as string[]) ?? []}
            onChange={field.onChange}
          />
        ),
      },
    ],
    [t, editing, reservedList, reservedButtons, handlers, lockedButtonKeys],
  );

  /** Form edita custom e reservadas em campos separados; no banco é tudo `variables`. */
  const toVariables = (values: { variables: TemplateVariable[]; reservedVariables: string[] }) => [
    ...values.variables,
    ...values.reservedVariables.map<TemplateVariable>((name) => ({
      name,
      type: reservedList.find((r) => r.name === name)?.type ?? 'STRING',
      required: false,
      reserved: true,
    })),
  ];

  /** Mesma ideia: custom e reservados são campos do form, mas uma lista só no banco. */
  const toButtons = (values: { buttons: TemplateButtonSlot[]; reservedButtons: string[] }) => [
    ...values.buttons.map((b) => ({
      key: b.key,
      kind: b.kind,
      required: b.required,
      ...(b.kind === 'URL' ? { urlBase: b.urlBase?.trim(), sensitive: !!b.sensitive } : {}),
    })),
    ...values.reservedButtons.map<TemplateButtonSlot>((key) => ({
      key,
      kind: reservedButtons.find((r) => r.key === key)?.kind ?? 'QUICK_REPLY',
      reserved: true,
      required: false,
    })),
  ];

  const editingValues = useMemo(() => {
    if (!editing) return undefined;
    return {
      ...editing,
      variables: editing.variables.filter((v) => !v.reserved),
      reservedVariables: editing.variables.filter((v) => v.reserved).map((v) => v.name),
      buttons: editing.buttons
        .filter((b) => !b.reserved)
        .map((b) => ({ ...b, required: b.required ?? true })),
      reservedButtons: editing.buttons.filter((b) => b.reserved).map((b) => b.key),
    };
  }, [editing]);

  const columns = useMemo<ColumnDef<MessagingTemplateType>[]>(
    () => [
      {
        accessorKey: 'key',
        header: () => <TableHead>{t('typeKey')}</TableHead>,
        cell: ({ row }) => (
          <DataCell>
            <span className="font-mono text-xs">{row.original.key}</span>
            {row.original.isSystem && (
              <Badge variant="outline" className="ml-2 text-xs">
                {t('isSystemBadge')}
              </Badge>
            )}
          </DataCell>
        ),
      },
      {
        accessorKey: 'name',
        header: () => <TableHead>{t('typeName')}</TableHead>,
        cell: ({ row }) => <DataCell>{row.original.name}</DataCell>,
      },
      {
        id: 'variables',
        header: () => <TableHead>{t('variables')}</TableHead>,
        cell: ({ row }) => (
          <DataCell className="flex flex-wrap gap-1">
            {row.original.variables.map((v) => (
              <Badge
                key={v.name}
                variant={v.reserved ? 'outline' : 'secondary'}
                className="font-mono text-xs"
              >
                {v.name}
              </Badge>
            ))}
          </DataCell>
        ),
      },
      {
        id: 'buttons',
        header: () => <TableHead>{t('typeButtons')}</TableHead>,
        cell: ({ row }) => (
          <DataCell className="flex flex-wrap gap-1">
            {row.original.buttons.map((b) => (
              <Badge
                key={b.key}
                variant={b.reserved ? 'outline' : 'secondary'}
                className="gap-1 font-mono text-xs"
              >
                <ButtonKindIcon kind={b.kind} className="size-3" />
                {b.key}
              </Badge>
            ))}
          </DataCell>
        ),
      },
      {
        id: 'actions',
        header: () => <TableHead>{t('actions')}</TableHead>,
        cell: ({ row }) => (
          <DataCell className="flex gap-2">
            <Button size="icon-sm" variant="ghost" onClick={() => setEditing(row.original)}>
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={row.original.isSystem || (row.original.templatesCount ?? 0) > 0}
              title={
                row.original.isSystem
                  ? t('cannotDeleteSystemTemplateType')
                  : (row.original.templatesCount ?? 0) > 0
                    ? t('typeInUseCannotDelete', { count: row.original.templatesCount ?? 0 })
                    : undefined
              }
              aria-label={t('deleteTemplateTypeTitle')}
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="size-4" />
            </Button>
          </DataCell>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        isLoading={isLoading}
        queryKey={['messaging', 'template-types', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('emptyTemplateTypes')}
        entityName={t('typeName')}
        entityNamePlural={t('typeName')}
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />

        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <Plus /> {t('newTemplateType')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <FormBuilderModal
        size="lg"
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={t('newTemplateType')}
        schema={schema}
        fields={fields}
        onSubmit={(values) =>
          createType.mutateAsync({
            key: values.key,
            name: values.name,
            variables: toVariables(values),
          })
        }
      />

      <FormBuilderModal
        size="lg"
        key={editing?.id ?? 'edit-closed'}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={t('editTemplateType')}
        schema={schema}
        fields={fields}
        mode="edit"
        values={editingValues}
        onSubmit={async (values) => {
          const variables = toVariables(values);
          const buttons = toButtons(values);
          const inUse = editing!.templatesCount ?? 0;
          // Nome do tipo não afeta template nenhum; variáveis e botões são o contrato deles.
          if (inUse > 0 && contractChanged(editing!, { variables, buttons })) {
            if (!(await confirmContractChange())) throw new SubmitCancelledError();
          }
          return updateType.mutateAsync({
            id: editing!.id,
            payload: { name: values.name, variables, buttons },
          });
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await removeType.mutateAsync(deleting.id);
          } catch {
            // O servidor recusa tipo em uso e o toast já mostra o motivo (lista os templates).
          }
          setDeleting(null);
        }}
        title={t('deleteTemplateTypeTitle')}
        description={t('deleteTemplateTypeDescription')}
      />

      <ConfirmDialog
        open={!!pendingChange}
        onOpenChange={(open) => !open && answerContractChange(false)}
        onConfirm={() => answerContractChange(true)}
        title={t('typeChangeConfirmTitle')}
        description={t('typeChangeConfirmDescription', { count: editing?.templatesCount ?? 0 })}
        confirmLabel={t('typeChangeConfirm')}
      />
    </>
  );
}
