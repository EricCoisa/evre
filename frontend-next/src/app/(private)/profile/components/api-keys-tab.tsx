"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { HelpButton, useTour, ignoreTourInteraction } from "@/components/tour";
import { useTranslation } from "@/hooks/use-translation";
import { DataTable } from "@/components/data-table";
import { FormBuilderModal, type FormBuilderField } from "@/components/form/form-builder";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Container } from "@/components/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TableHead, DataCell } from "@/components/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useUpdateApiKeyScopes,
} from "@/lib/actions/api-keys/queries";
import type { ApiKey, CreateApiKeyDto, McpScope } from "@/lib/actions/api-keys/types";
import { MCP_SCOPES } from "@/lib/actions/api-keys/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CopyField } from "@/components/copy-field";

function ScopeCheckboxes({
  selectedScopes,
  onChange,
}: {
  selectedScopes: McpScope[];
  onChange: (scopes: McpScope[]) => void;
}) {
  const { t } = useTranslation("profile");

  const toggle = (scope: McpScope) =>
    onChange(selectedScopes.includes(scope)
      ? selectedScopes.filter((s) => s !== scope)
      : [...selectedScopes, scope]);

  return (
    <div className="space-y-2">
      {MCP_SCOPES.map((scope) => (
        <div key={scope} className="flex items-center gap-2">
          <Checkbox
            id={scope}
            checked={selectedScopes.includes(scope)}
            onCheckedChange={() => toggle(scope)}
          />
          <Label htmlFor={scope}>{t(`scope_${scope.replace(/[:-]/g, "_").toLowerCase()}`)}</Label>
        </div>
      ))}
    </div>
  );
}

function RawKeyDialog({
  open,
  onOpenChange,
  rawKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rawKey: string;
}) {
  const { t } = useTranslation("profile");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onInteractOutside={ignoreTourInteraction}>
        <DialogHeader>
          <DialogTitle>{t("apiKeyCreated")}</DialogTitle>
          <DialogDescription>{t("rawKeyWarning")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <CopyField value={rawKey} label={t("yourApiKey")} />
          <p className="text-sm text-destructive">{t("rawKeyWarning")}</p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("copyKey")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysTab() {
  const { t } = useTranslation("profile");
  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [rawKeyDialogOpen, setRawKeyDialogOpen] = useState(false);
  const [createdRawKey, setCreatedRawKey] = useState("");
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editingScopes, setEditingScopes] = useState<McpScope[]>([]);

  const { data: rawData, error } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const updateScopes = useUpdateApiKeyScopes();

  const data = useMemo(() => rawData ?? [], [rawData]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingKey) return;
    try {
      await revokeKey.mutateAsync(deletingKey.id);
      toast.success(t("revokeSuccess"));
    } catch {
      // Alive handles toast.error internally
    } finally {
      setDeletingKey(null);
    }
  }, [revokeKey, deletingKey, t]);

  const schema = useMemo(() =>
    z.object({
      name: z.string().min(1, t("keyNameRequired")),
      scopes: z.array(z.enum(MCP_SCOPES as [McpScope, ...McpScope[]])).min(1, t("keyScopesRequired")),
      expiresAt: z.string().optional().nullable(),
    }), [t]);

  const fields = useMemo<FormBuilderField[]>(() => [
    { name: "name", label: t("keyName"), placeholder: t("keyNamePlaceholder") },
    {
      name: "scopes",
      label: t("keyScopes"),
      type: "custom",
      render: ({ value, onChange }) => (
        <ScopeCheckboxes
          selectedScopes={value as McpScope[]}
          onChange={(v) => onChange(v)}
        />
      ),
    },
    {
      name: "expiresAt",
      label: t("keyExpiresAt"),
      type: "date",
      placeholder: t("keyExpiresAtPlaceholder"),
    },
  ], [t]);

  const columns = useMemo<ColumnDef<ApiKey>[]>(() => [
    {
      accessorKey: "name",
      header: () => <TableHead>{t("keyName")}</TableHead>,
      cell: ({ row }) => <DataCell className="font-medium">{row.getValue("name")}</DataCell>,
    },
    {
      accessorKey: "keyPrefix",
      header: () => <TableHead>{t("keyPrefix")}</TableHead>,
      cell: ({ row }) => <DataCell className="font-mono text-xs"><code>{row.getValue("keyPrefix")}</code></DataCell>,
    },
    {
      accessorKey: "scopes",
      header: () => <TableHead>{t("keyScopes")}</TableHead>,
      cell: ({ row }) => {
        const scopes = row.getValue("scopes") as McpScope[];
        return (
          <DataCell>
            {scopes.length ? (
              <div className="flex flex-wrap gap-1">
                {scopes.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : "—"}
          </DataCell>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: () => <TableHead>{t("createdAt")}</TableHead>,
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return <DataCell>{new Date(date).toLocaleDateString()}</DataCell>;
      },
    },
    {
      accessorKey: "lastUsedAt",
      header: () => <TableHead>{t("lastUsed")}</TableHead>,
      cell: ({ row }) => {
        const date = row.getValue("lastUsedAt") as string | null;
        return <DataCell>{date ? new Date(date).toLocaleDateString() : "—"}</DataCell>;
      },
    },
    {
      accessorKey: "expiresAt",
      header: () => <TableHead>{t("expiresAt")}</TableHead>,
      cell: ({ row }) => {
        const date = row.getValue("expiresAt") as string | null;
        return <DataCell>{date ? new Date(date).toLocaleDateString() : "—"}</DataCell>;
      },
    },
    {
      id: "actions",
      header: () => <TableHead>{t("actions")}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                const key = row.original;
                setEditingKey(key);
                setEditingScopes(key.scopes);
              }}
              disabled={updateScopes.isPending}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setDeletingKey(row.original)}
              disabled={revokeKey.isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </DataCell>
      ),
    },
  ], [t, revokeKey.isPending, updateScopes.isPending]);

  const handleCreateSubmit = async (data: CreateApiKeyDto) => {
    const result = await createKey.mutateAsync(data);
    if (result?.rawKey) {
      setCreatedRawKey(result.rawKey);
      setRawKeyDialogOpen(true);
    }
  };

  const { registerTour } = useTour();

  useEffect(() => {
    registerTour('profile-api-keys', [
      {
        content: t('tour_api_keys_intro'),
        selectorId: 'api-keys-table-container',
        position: 'bottom',
      },
      {
        content: t('tour_api_keys_create'),
        selectorId: 'btn-new-api-key',
        position: 'bottom',
      },
      {
        content: t('tour_api_keys_table'),
        selectorId: 'api-keys-table-container',
        position: 'top',
      },
    ]);
  }, [registerTour, t]);

  return (
      <Container variant="form" padding>
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold">{t("apiKeys")}</h2>
            <p className="text-sm text-muted-foreground">{t("createDescription")}</p>
          </div>
          <HelpButton tourId="profile-api-keys" startDirect />
        </div>
        <div id="api-keys-table-container">
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={["api-keys"]}
        pagination={pagination}
        onPaginationChange={setPagination}
        enableGlobalFilter={true}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("noKeys")}
        entityName={t("entity")}
        entityNamePlural={t("entityPlural")}
      >
        <DataTable.Input
          title={t("keyName")}
          placeholder={t("searchPlaceholder")}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button id="btn-new-api-key" onClick={() => setIsCreateOpen(true)}>
            <Plus /> {t("newApiKey")}
          </Button>
        </DataTable.Actions>
      </DataTable>
        </div>

      <FormBuilderModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={t("createTitle")}
        description={t("createDescription")}
        schema={schema}
        fields={fields}
        onSubmit={handleCreateSubmit}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["api-keys"] })}
        submitLabel={t("submitCreate")}
      />

      <RawKeyDialog
        open={rawKeyDialogOpen}
        onOpenChange={setRawKeyDialogOpen}
        rawKey={createdRawKey}
      />

      <ConfirmDialog
        open={!!deletingKey}
        onOpenChange={(v) => !v && setDeletingKey(null)}
        onConfirm={handleConfirmDelete}
        title={t("revokeConfirmTitle")}
        description={t("revokeConfirmDescription")}
        confirmLabel={t("revoke")}
        cancelLabel={t("cancel")}
      />

      <Dialog
        open={!!editingKey}
        onOpenChange={(v) => {
          if (!v) {
            setEditingKey(null);
            setEditingScopes([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editScopesTitle")}</DialogTitle>
          </DialogHeader>
          {editingKey && (
            <div className="space-y-4 py-2">
              <ScopeCheckboxes
                selectedScopes={editingScopes}
                onChange={setEditingScopes}
              />
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingKey(null);
                setEditingScopes([]);
              }}
              disabled={updateScopes.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={async () => {
                if (!editingKey) return;
                try {
                  await updateScopes.mutateAsync({
                    id: editingKey.id,
                    scopes: editingScopes,
                  });
                  toast.success(t("updateScopesSuccess"));
                  setEditingKey(null);
                  setEditingScopes([]);
                } catch {
                  // Alive handles toast.error internally
                }
              }}
              disabled={updateScopes.isPending}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
}