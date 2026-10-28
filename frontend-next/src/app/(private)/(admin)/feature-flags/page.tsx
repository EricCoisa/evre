'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { DataTable } from '@/components/data-table';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FeatureFlagSwitch } from '@/components/feature-flag-switch';
import { RoleBadge } from '@/components/role-badge';
import {
  Plus,
  Pencil,
  Trash2,
  Tags,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TableHead, DataCell } from '@/components/table-utils';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useFeatureFlags,
  useCreateFeatureFlag,
  useUpdateFeatureFlag,
  useDeleteFeatureFlag,
  useSetFeatureFlagRoles,
} from '@/lib/actions/feature-flag/queries';
import {
  type FeatureFlag,
  type FeatureFlagCategory,
  FeatureFlagCategoryConst,
} from '@/lib/actions/feature-flag/types';

const FEATURE_FLAG_CATEGORIES = Object.values(FeatureFlagCategoryConst);
import { useRoles } from '@/lib/actions/user/queries';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

function RolesDialog({
  flag,
  open,
  onOpenChange,
}: {
  flag: FeatureFlag | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation('feature-flags');
  const { data: roles } = useRoles();
  const setRoles = useSetFeatureFlagRoles();
  const [selected, setSelected] = useState<string[]>([]);
  const [resetKey, setResetKey] = useState<{ flag: FeatureFlag | null; open: boolean }>({ flag: null, open: false });

  if (resetKey.flag !== flag || resetKey.open !== open) {
    setResetKey({ flag, open });
    setSelected(flag?.roles.map((r) => r.roleId) ?? []);
  }

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allIds = roles?.map((r) => r.value) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);

  const handleSave = async () => {
    if (!flag) return;
    try {
      await setRoles.mutateAsync({ id: flag.id, dto: { roleIds: selected } });
      toast.success(t('saveRoles'));
      onOpenChange(false);
    } catch {
      // Handled internally
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('manageRoles')}</DialogTitle>
          <DialogDescription>{t('manageRolesDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {roles?.length ? (
            <>
              <div className="flex items-center gap-2 pb-1 border-b">
                <Checkbox
                  id="select-all-roles"
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
                <Label htmlFor="select-all-roles" className="font-medium">{t('selectAll')}</Label>
              </div>
              {roles.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <Checkbox
                    id={r.value}
                    checked={selected.includes(r.value)}
                    onCheckedChange={() => toggle(r.value)}
                  />
                  <Label htmlFor={r.value}>{r.label}</Label>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noRoles')}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={setRoles.isPending}>{t('saveRoles')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NO_PARENT = '__none__';

type FlagTreeRow = FeatureFlag & { depth: number; hasChildren: boolean };

function buildFlagTree(flags: FeatureFlag[], collapsedIds: Set<string>): FlagTreeRow[] {
  const byId = new Map(flags.map((f) => [f.id, f]));
  const childrenByParent = new Map<string, FeatureFlag[]>();
  for (const flag of flags) {
    if (flag.parentId && byId.has(flag.parentId)) {
      const siblings = childrenByParent.get(flag.parentId) ?? [];
      siblings.push(flag);
      childrenByParent.set(flag.parentId, siblings);
    }
  }

  const roots = flags.filter((f) => !f.parentId || !byId.has(f.parentId));
  const rows: FlagTreeRow[] = [];
  const visited = new Set<string>();

  const visit = (flag: FeatureFlag, depth: number) => {
    if (visited.has(flag.id)) return;
    visited.add(flag.id);
    const children = childrenByParent.get(flag.id) ?? [];
    rows.push({ ...flag, depth, hasChildren: children.length > 0 });
    if (!collapsedIds.has(flag.id)) {
      children.forEach((child) => visit(child, depth + 1));
    }
  };

  roots.forEach((root) => visit(root, 0));
  return rows;
}

export default function FeatureFlagsPage() {
  const { t } = useTranslation('feature-flags');
  const { t: tCommon } = useTranslation('common');
  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const { data: rawData, error } = useFeatureFlags();
  const createFlag = useCreateFeatureFlag();
  const updateFlag = useUpdateFeatureFlag();
  const deleteFlag = useDeleteFeatureFlag();

  const categoryOptions = useMemo(
    () =>
      FEATURE_FLAG_CATEGORIES.map((cat) => ({
        value: cat,
        label: t(`categories.${cat}`),
      })),
    [t],
  );

  const statusOptions = useMemo(() => [
    { value: 'true', label: t('filterEnabled') },
    { value: 'false', label: t('filterDisabled') },
  ], [t]);

  const filteredData = useMemo(() => {
    if (!rawData) return [];
    return rawData.filter((f) => {
      const statusFilter = filters['enabled'];
      const matchEnabled = !statusFilter || statusFilter === 'all' || String(f.enabled) === statusFilter;
      const catFilter = filters['category'];
      const matchCategory = !catFilter || catFilter === 'all' || f.category === catFilter;
      const searchMatch = !globalFilter || 
        f.key.toLowerCase().includes(globalFilter.toLowerCase()) ||
        (f.description && f.description.toLowerCase().includes(globalFilter.toLowerCase()));
      return matchEnabled && matchCategory && searchMatch;
    });
  }, [rawData, filters, globalFilter]);

  const rows = useMemo(() => buildFlagTree(filteredData, collapsedIds), [filteredData, collapsedIds]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [rolesFlag, setRolesFlag] = useState<FeatureFlag | null>(null);
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [deletingFlag, setDeletingFlag] = useState<FeatureFlag | null>(null);

  const handleEdit = useCallback((flag: FeatureFlag) => setEditingFlag(flag), []);
  const handleManageRoles = useCallback((flag: FeatureFlag) => {
    setRolesFlag(flag);
    setIsRolesOpen(true);
  }, []);

  const handleDelete = useCallback((flag: FeatureFlag) => setDeletingFlag(flag), []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingFlag) return;
    try {
      await deleteFlag.mutateAsync(deletingFlag.id);
      toast.success(t('deleteSuccess'));
    } catch {
      // Handled internally
    } finally {
      setDeletingFlag(null);
    }
  }, [deleteFlag, deletingFlag, t]);

  const schema = useMemo(() =>
    z.object({
      key: z.string().min(1, t('keyRequired')),
      description: z.string().optional(),
      category: z
        .enum(FEATURE_FLAG_CATEGORIES as [string, ...string[]])
        .default(FeatureFlagCategoryConst.GENERAL),
      isSystem: z.boolean().default(false),
      enabled: z.boolean().optional(),
      parentId: z.string().optional(),
    }), [t]);

  const fields = useMemo<FormBuilderField[]>(() => [
    { name: 'key', label: t('key'), placeholder: t('keyPlaceholder'), description: t('keyDescription') },
    { name: 'description', label: t('description_field'), placeholder: t('descriptionPlaceholder') },
    {
      name: 'category',
      label: t('category'),
      type: 'select',
      options: categoryOptions,
    },
    { name: 'isSystem', label: t('isSystemLabel'), type: 'checkbox' },
    { name: 'enabled', label: t('enabledLabel'), type: 'checkbox' },
    {
      name: 'parentId',
      label: t('parentFlag'),
      type: 'select',
      description: t('parentFlagDescription'),
      options: [
        { value: NO_PARENT, label: t('noParent') },
        ...(rawData ?? [])
          .filter((f) => f.id !== editingFlag?.id)
          .map((f) => ({ value: f.id, label: f.key })),
      ],
    },
  ], [t, categoryOptions, rawData, editingFlag]);

  const columns = useMemo<ColumnDef<FlagTreeRow>[]>(() => [
    {
      accessorKey: 'key',
      header: () => <TableHead>{t('key')}</TableHead>,
      cell: ({ row }) => {
        const { id, depth, hasChildren, category, isSystem } = row.original;
        const isCollapsed = collapsedIds.has(id);
        const rawKey = row.getValue('key') as string;
        const friendlyName = t(`flags.${rawKey}`);
        const displayName = friendlyName !== `flags.${rawKey}` ? friendlyName : rawKey;
        const categoryLabel = category ? t(`categories.${category}`) : null;

        return (
          <DataCell className="py-2.5">
            <div className="flex items-start gap-2" style={{ paddingLeft: depth * 24 }}>
              {depth > 0 && (
                <div
                  aria-hidden
                  className="mt-2.5 h-3.5 w-2.5 -ml-3 border-l-2 border-b-2 border-border/80 rounded-bl-sm"
                />
              )}

              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleCollapsed(id)}
                  aria-label={isCollapsed ? tCommon('expand') : tCommon('collapse')}
                  className="mt-0.5 shrink-0 rounded p-1 hover:bg-muted text-muted-foreground transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
              ) : (
                <span className="inline-block size-4 shrink-0 mt-0.5" />
              )}

              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground leading-none">
                    {displayName}
                  </span>
                  {categoryLabel && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                      {categoryLabel}
                    </Badge>
                  )}
                  {isSystem && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                      Sistema
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-[11px] text-muted-foreground/80 tracking-tight">
                  {rawKey}
                </span>
              </div>
            </div>
          </DataCell>
        );
      },
    },
    {
      accessorKey: 'description',
      header: () => <TableHead>{t('description_field')}</TableHead>,
      cell: ({ row }) => {
        const desc = row.getValue('description') as string | null;
        return (
          <DataCell className="text-xs text-muted-foreground max-w-md line-clamp-2">
            {desc ?? '—'}
          </DataCell>
        );
      },
    },
    {
      accessorKey: 'enabled',
      meta: { mobileWidth: 'half', mobileOrder: 3 },
      header: () => <TableHead className="w-28 text-center">{t('enabled')}</TableHead>,
      cell: ({ row }) => (
        <DataCell className="w-28 text-center">
          <FeatureFlagSwitch id={row.original.id} enabled={row.getValue('enabled')} />
        </DataCell>
      ),
    },
    {
      accessorKey: 'roles',
      meta: { mobileWidth: 'half', mobileOrder: 4 },
      header: () => <TableHead>{t('roles')}</TableHead>,
      cell: ({ row }) => {
        const { roles, isSystem } = row.original;
        if (isSystem) {
          return (
            <DataCell>
              <span className="text-xs text-muted-foreground italic">Todas as roles (Sistema)</span>
            </DataCell>
          );
        }
        return (
          <DataCell>
            {roles.length ? (
              <div className="flex flex-wrap items-center gap-1">
                {roles.slice(0, 3).map((r) => (
                  <RoleBadge key={r.id} role={r.role.name}>{r.role.name}</RoleBadge>
                ))}
                {roles.length > 3 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    +{roles.length - 3}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground font-mono">—</span>
            )}
          </DataCell>
        );
      },
    },
    {
      id: 'actions',
      meta: { mobileWidth: 'full', mobileOrder: 5 },
      header: () => <TableHead className="w-28 text-right">{t('actions')}</TableHead>,
      cell: ({ row }) => (
        <DataCell className="w-28 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              className="size-9 rounded-md"
              onClick={() => handleEdit(row.original)}
              title={t('submitEdit')}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 rounded-md"
              onClick={() => handleManageRoles(row.original)}
              title={t('manageRoles')}
            >
              <Tags className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 rounded-md text-destructive hover:text-destructive"
              onClick={() => handleDelete(row.original)}
              title={t('deleteConfirmTitle')}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </DataCell>
      ),
    },
  ], [t, tCommon, collapsedIds, toggleCollapsed, handleEdit, handleManageRoles, handleDelete]);

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={t('title')}
        description={t('description')}
      />
      <DataTable
        columns={columns}
        data={rows}
        error={error}
        queryKey={['feature-flags']}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('noFlags')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input
          title={t('key')}
          placeholder={t('searchPlaceholder')}
        />
        <DataTable.Select
          title={t('categoryFilter')}
          accessorKey="category"
          placeholder={t('categoryFilter')}
          options={categoryOptions}
        />
        <DataTable.Select
          title={t('status')}
          accessorKey="enabled"
          placeholder={t('status')}
          options={statusOptions}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" /> {t('entity')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <FormBuilderModal
        size="lg"
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={t('createTitle')}
        description={t('createDescription')}
        schema={schema}
        fields={fields}
        onSubmit={async (formData) => createFlag.mutateAsync({
          key: formData.key as string,
          description: (formData.description as string) || undefined,
          category: (formData.category as FeatureFlagCategory) || FeatureFlagCategoryConst.GENERAL,
          isSystem: Boolean(formData.isSystem),
          enabled: Boolean(formData.enabled),
          parentId: formData.parentId && formData.parentId !== NO_PARENT ? (formData.parentId as string) : undefined,
        })}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['feature-flags'] })}
        submitLabel={t('submitCreate')}
      />

      <FormBuilderModal
        size="lg"
        open={!!editingFlag}
        onOpenChange={(v) => !v && setEditingFlag(null)}
        mode="edit"
        title={t('editTitle')}
        description={t('editDescription')}
        schema={schema}
        fields={fields}
        values={editingFlag ? {
          key: editingFlag.key,
          description: editingFlag.description ?? undefined,
          category: editingFlag.category ?? FeatureFlagCategoryConst.GENERAL,
          isSystem: editingFlag.isSystem,
          enabled: editingFlag.enabled,
          parentId: editingFlag.parentId ?? NO_PARENT,
        } : undefined}
        onSubmit={async (formData) => updateFlag.mutateAsync({
          id: editingFlag!.id,
          dto: {
            description: (formData.description as string) || undefined,
            category: (formData.category as FeatureFlagCategory) || FeatureFlagCategoryConst.GENERAL,
            isSystem: Boolean(formData.isSystem),
            enabled: Boolean(formData.enabled),
            parentId: formData.parentId && formData.parentId !== NO_PARENT ? (formData.parentId as string) : null,
          },
        })}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['feature-flags'] })}
        submitLabel={t('submitEdit')}
      />

      <RolesDialog
        flag={rolesFlag}
        open={isRolesOpen}
        onOpenChange={(v) => {
          setIsRolesOpen(v);
          if (!v) setRolesFlag(null);
        }}
      />

      <ConfirmDialog
        open={!!deletingFlag}
        onOpenChange={(v) => !v && setDeletingFlag(null)}
        onConfirm={handleConfirmDelete}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDescription')}
      />
    </Container>
  );
}
