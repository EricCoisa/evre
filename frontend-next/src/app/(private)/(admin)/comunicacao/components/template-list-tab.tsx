'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Pencil, Eye, Send, RefreshCw, CloudDownload } from 'lucide-react';
import { useTranslation, type TFunc } from '@/hooks/use-translation';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TableHead, DataCell } from '@/components/table-utils';
import {
  useTemplateTypes,
  useTemplates,
  useRemoveTemplate,
  useReconcileTemplateSubmissions,
  useMessagingConnections,
  useNativeButtonsSupport,
} from '@/lib/actions/messaging/queries';
import type {
  MessagingTemplateCatalogItem,
  MessagingConnection,
  MessagingTemplateType,
} from '@/lib/actions/messaging/types';
import { TemplatePreview } from './template-preview';
import { TemplateFormDialog } from './template-form-dialog';
import { TemplateSubmitDialog } from './template-submit-dialog';
import { TemplateApprovalStatus } from './template-approval-status';
import { TemplateDeleteDialog, TemplateSyncPrompt, hasActiveSubmission } from './template-sync-dialogs';
import { RemoteTemplatesDialog } from './remote-templates-dialog';
import { buildTableQueryParams } from '@/lib/table-query-params';

function getTemplateTableColumns({
  connections,
  approval,
  showApproval,
  onPreview,
  onSubmit,
  onEdit,
  onDelete,
  t,
}: {
  connections: MessagingConnection[];
  approval: boolean;
  showApproval: boolean;
  onPreview: (item: MessagingTemplateCatalogItem) => void;
  onSubmit: (item: MessagingTemplateCatalogItem) => void;
  onEdit: (item: MessagingTemplateCatalogItem) => void;
  onDelete: (item: MessagingTemplateCatalogItem) => void;
  t: TFunc;
}): ColumnDef<MessagingTemplateCatalogItem>[] {
  return [
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
          {row.original.invalidReason && (
            <div className="mt-1 grid gap-0.5">
              <Badge variant="destructive" className="w-fit text-xs">
                {t('needsAdjustmentBadge')}
              </Badge>
              <p className="max-w-xs whitespace-normal text-xs text-destructive">
                {row.original.invalidReason}
              </p>
            </div>
          )}
        </DataCell>
      ),
    },
    {
      accessorKey: 'language',
      header: () => <TableHead>{t('templateLanguage')}</TableHead>,
      cell: ({ row }) => <DataCell>{row.original.language}</DataCell>,
    },
    {
      accessorKey: 'category',
      header: () => <TableHead>{t('templateCategory')}</TableHead>,
      cell: ({ row }) => <DataCell>{t(row.original.category)}</DataCell>,
    },
    ...(showApproval
      ? [
          {
            id: 'approval',
            header: () => <TableHead>{t('approvalStatusLabel')}</TableHead>,
            cell: ({ row }: { row: { original: MessagingTemplateCatalogItem } }) => (
              <DataCell>
                <TemplateApprovalStatus submissions={row.original.submissions} connections={connections} />
              </DataCell>
            ),
          } satisfies ColumnDef<MessagingTemplateCatalogItem>,
        ]
      : []),
    {
      id: 'actions',
      header: () => <TableHead>{t('actions')}</TableHead>,
      cell: ({ row }) => (
        <DataCell className="flex gap-2">
          <Button size="icon-sm" variant="ghost" onClick={() => onPreview(row.original)}>
            <Eye className="size-4" />
          </Button>
          {approval && (
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={Boolean(row.original.invalidReason)}
              title={row.original.invalidReason ? t('needsAdjustmentCannotSubmit') : undefined}
              onClick={() => onSubmit(row.original)}
            >
              <Send className="size-4" />
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" onClick={() => onEdit(row.original)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={row.original.isSystem}
            title={row.original.isSystem ? t('cannotDeleteSystemTemplate') : undefined}
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="size-4" />
          </Button>
        </DataCell>
      ),
    },
  ];
}

function TemplateListDialogs({
  types,
  connections,
  approvalConnectionIds,
  isCreateOpen,
  setIsCreateOpen,
  editing,
  setEditing,
  deleting,
  setDeleting,
  submitting,
  setSubmitting,
  syncPrompt,
  setSyncPrompt,
  previewing,
  setPreviewing,
  isRemoteTemplatesOpen,
  setIsRemoteTemplatesOpen,
  removePending,
  onRemove,
}: {
  types: MessagingTemplateType[];
  connections: MessagingConnection[];
  approvalConnectionIds: string[];
  isCreateOpen: boolean;
  setIsCreateOpen: (v: boolean) => void;
  editing: MessagingTemplateCatalogItem | null;
  setEditing: (v: MessagingTemplateCatalogItem | null) => void;
  deleting: MessagingTemplateCatalogItem | null;
  setDeleting: (v: MessagingTemplateCatalogItem | null) => void;
  submitting: MessagingTemplateCatalogItem | null;
  setSubmitting: (v: MessagingTemplateCatalogItem | null) => void;
  syncPrompt: MessagingTemplateCatalogItem | null;
  setSyncPrompt: (v: MessagingTemplateCatalogItem | null) => void;
  previewing: MessagingTemplateCatalogItem | null;
  setPreviewing: (v: MessagingTemplateCatalogItem | null) => void;
  isRemoteTemplatesOpen: boolean;
  setIsRemoteTemplatesOpen: (v: boolean) => void;
  removePending: boolean;
  onRemove: (template: MessagingTemplateCatalogItem, remote: boolean) => Promise<void>;
}) {
  return (
    <>
      <TemplateFormDialog
        key={isCreateOpen ? 'create-open' : 'create-closed'}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        types={types}
        editing={null}
      />

      <TemplateFormDialog
        key={editing?.id ?? 'edit-closed'}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        types={types}
        editing={editing}
        onUpdated={(template) => {
          if (hasActiveSubmission(template, connections)) setSyncPrompt(template);
        }}
      />

      <TemplateDeleteDialog
        key={deleting?.id ?? 'delete-closed'}
        template={deleting}
        connections={connections}
        pending={removePending}
        onClose={() => setDeleting(null)}
        onConfirm={onRemove}
      />

      <TemplateSyncPrompt
        template={syncPrompt}
        onClose={() => setSyncPrompt(null)}
        onSync={(template) => {
          setSyncPrompt(null);
          setSubmitting(template);
        }}
      />

      <TemplateSubmitDialog
        template={submitting}
        types={types}
        onOpenChange={(open) => !open && setSubmitting(null)}
      />

      <RemoteTemplatesDialog
        open={isRemoteTemplatesOpen}
        onOpenChange={setIsRemoteTemplatesOpen}
        approvalConnectionIds={approvalConnectionIds}
      />

      <Dialog open={Boolean(previewing)} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{previewing?.key}</DialogTitle>
          </DialogHeader>
          {previewing && <TemplatePreview template={previewing} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TemplateListTab() {
  const { t } = useTranslation('messaging');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const queryParams = buildTableQueryParams(pagination, globalFilter, filters);

  const { data, error, isLoading } = useTemplates({
    ...queryParams,
    pagination: true,
  } as never);
  const { data: typesPage } = useTemplateTypes({ pagination: false } as never);
  const types = useMemo(
    () => (Array.isArray(typesPage) ? typesPage : typesPage?.data ?? []),
    [typesPage],
  );
  const { data: connections = [] } = useMessagingConnections();
  const { approval, approvalConnectionIds } = useNativeButtonsSupport();
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  const showApproval = approval || items.some((item) => (item.submissions?.length ?? 0) > 0);

  const removeTemplate = useRemoveTemplate();
  const reconcile = useReconcileTemplateSubmissions();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MessagingTemplateCatalogItem | null>(null);
  const [previewing, setPreviewing] = useState<MessagingTemplateCatalogItem | null>(null);
  const [deleting, setDeleting] = useState<MessagingTemplateCatalogItem | null>(null);
  const [submitting, setSubmitting] = useState<MessagingTemplateCatalogItem | null>(null);
  const [syncPrompt, setSyncPrompt] = useState<MessagingTemplateCatalogItem | null>(null);
  const [isRemoteTemplatesOpen, setIsRemoteTemplatesOpen] = useState(false);

  const checkStatuses = async () => {
    const results = await Promise.allSettled(approvalConnectionIds.map((id) => reconcile.mutateAsync(id)));
    const updated = results.reduce(
      (sum, r) => sum + (r.status === 'fulfilled' ? (r.value?.updated ?? 0) : 0),
      0,
    );
    toast.success(updated > 0 ? t('reconcileUpdated', { count: updated }) : t('reconcileNothing'));
  };

  const columns = useMemo<ColumnDef<MessagingTemplateCatalogItem>[]>(
    () =>
      getTemplateTableColumns({
        connections,
        approval,
        showApproval,
        onPreview: setPreviewing,
        onSubmit: setSubmitting,
        onEdit: setEditing,
        onDelete: setDeleting,
        t,
      }),
    [t, connections, approval, showApproval],
  );

  const categoryChanged = items.filter((item) => item.previousCategory).length;

  return (
    <>
      {categoryChanged > 0 && (
        <Alert className="mb-3 border-amber-500">
          <AlertTitle>{t('categoryChangedBanner', { count: categoryChanged })}</AlertTitle>
          <AlertDescription>{t('categoryChangedNote')}</AlertDescription>
        </Alert>
      )}
      <DataTable
        columns={columns}
        data={data}
        error={error}
        isLoading={isLoading}
        queryKey={['messaging', 'templates', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('emptyTemplates')}
        entityName={t('typeName')}
        entityNamePlural={t('typeName')}
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />

        <DataTable.Select
          title={t('templateCategory')}
          accessorKey="category"
          placeholder={t('templateCategory')}
        />

        <DataTable.Actions className="sm:justify-end sm:w-full">
          {approval && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRemoteTemplatesOpen(true)}
              >
                <CloudDownload className="size-4" /> {t('remoteTemplatesBtn')}
              </Button>
              <Button type="button" variant="outline" onClick={checkStatuses} disabled={reconcile.isPending}>
                <RefreshCw className={reconcile.isPending ? 'animate-spin' : ''} /> {t('reconcileStatus')}
              </Button>
            </>
          )}
          <Button type="button" onClick={() => setIsCreateOpen(true)} disabled={types.length === 0}>
            <Plus /> {t('newTemplate')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <TemplateListDialogs
        types={types}
        connections={connections}
        approvalConnectionIds={approvalConnectionIds}
        isCreateOpen={isCreateOpen}
        setIsCreateOpen={setIsCreateOpen}
        editing={editing}
        setEditing={setEditing}
        deleting={deleting}
        setDeleting={setDeleting}
        submitting={submitting}
        setSubmitting={setSubmitting}
        syncPrompt={syncPrompt}
        setSyncPrompt={setSyncPrompt}
        previewing={previewing}
        setPreviewing={setPreviewing}
        isRemoteTemplatesOpen={isRemoteTemplatesOpen}
        setIsRemoteTemplatesOpen={setIsRemoteTemplatesOpen}
        removePending={removeTemplate.isPending}
        onRemove={async (template, remote) => {
          try {
            await removeTemplate.mutateAsync({ id: template.id, remote });
            setDeleting(null);
          } catch {
            // Collector já mostrou o motivo (ex.: Meta recusou); o diálogo fica aberto para decidir.
          }
        }}
      />
    </>
  );
}
