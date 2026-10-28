'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Link as LinkIcon, CheckCircle2, AlertCircle, Download, Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useMessagingConnections,
  useRemoteTemplates,
  useLinkRemoteTemplate,
  useImportRemoteTemplate,
} from '@/lib/actions/messaging/queries';
import { connectionDisplayName } from '@/lib/messaging/connection';
import type { RemoteTemplateItem, MessagingConnection } from '@/lib/actions/messaging/types';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

function getStatusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">{status}</Badge>;
    case 'REJECTED':
      return <Badge variant="destructive">{status}</Badge>;
    case 'PAUSED':
    case 'DISABLED':
      return <Badge variant="outline" className="border-amber-500 text-amber-600">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

async function syncRemoteTemplates({
  remoteTemplates,
  activeConnectionId,
  linkMutation,
  importMutation,
}: {
  remoteTemplates: RemoteTemplateItem[];
  activeConnectionId: string;
  linkMutation: ReturnType<typeof useLinkRemoteTemplate>;
  importMutation: ReturnType<typeof useImportRemoteTemplate>;
}) {
  for (const remote of remoteTemplates) {
    if (remote.linkedTemplateId) continue;
    const exact = remote.suggestedTemplates.find((s) => s.exactMatch);
    if (exact) {
      await linkMutation.mutateAsync({
        connectionId: activeConnectionId,
        payload: {
          remoteTemplateId: remote.providerTemplateId,
          templateId: exact.id,
        },
      });
    } else {
      await importMutation.mutateAsync({
        connectionId: activeConnectionId,
        payload: {
          remoteTemplateId: remote.providerTemplateId,
        },
      });
    }
  }
}

function RemoteTemplateLinkCell({
  remote,
  defaultSelected,
  isLinked,
  onSelectLocal,
  onLink,
  onImport,
  isLinking,
  isImporting,
  t,
}: {
  remote: RemoteTemplateItem;
  defaultSelected: string;
  isLinked: boolean;
  onSelectLocal: (localId: string) => void;
  onLink: () => void;
  onImport: () => void;
  isLinking: boolean;
  isImporting: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (isLinked) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
        <CheckCircle2 className="size-4 shrink-0" />
        <span>
          {t('remoteTemplateAlreadyLinked', {
            key: remote.linkedTemplateKey ?? remote.linkedTemplateId ?? '',
          })}
        </span>
      </div>
    );
  }

  if (remote.suggestedTemplates.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t('remoteTemplateNoCandidates', {
            name: remote.name,
            language: remote.language,
          })}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2.5 text-xs shrink-0"
          disabled={isImporting}
          onClick={onImport}
        >
          <Download className="size-3.5 mr-1" />
          {isImporting ? t('remoteTemplateImporting') : t('remoteTemplateImportBtn')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={defaultSelected} onValueChange={onSelectLocal}>
        <SelectTrigger className="h-8 text-xs max-w-[240px]">
          <SelectValue placeholder={t('remoteTemplateLinkSelectPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {remote.suggestedTemplates.map((local) => (
            <SelectItem key={local.id} value={local.id} className="text-xs">
              <span className="font-mono">{local.key}</span>
              {local.exactMatch && (
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                  {t('remoteTemplateExactMatch')}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2.5 text-xs"
        disabled={isLinking || !defaultSelected}
        onClick={onLink}
      >
        <LinkIcon className="size-3.5 mr-1" />
        {isLinking ? t('remoteTemplateLinking') : t('remoteTemplateLinkBtn')}
      </Button>
    </div>
  );
}

function RemoteTemplateRow({
  remote,
  selectedLocalId,
  onSelectLocal,
  onLink,
  onImport,
  isLinking,
  isImporting,
  t,
}: {
  remote: RemoteTemplateItem;
  selectedLocalId?: string;
  onSelectLocal: (localId: string) => void;
  onLink: () => void;
  onImport: () => void;
  isLinking: boolean;
  isImporting: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const isLinked = Boolean(remote.linkedTemplateId);
  const defaultSelected =
    selectedLocalId ||
    remote.suggestedTemplates.find((s) => s.exactMatch)?.id ||
    remote.suggestedTemplates[0]?.id ||
    '';

  return (
    <TableRow key={remote.providerTemplateId}>
      <TableCell>
        <span className="font-mono text-xs font-semibold">{remote.name}</span>
        {remote.reason && (
          <p className="text-xs text-destructive mt-0.5">{remote.reason}</p>
        )}
      </TableCell>
      <TableCell className="text-xs">{remote.language}</TableCell>
      <TableCell className="text-xs">{remote.category ?? '-'}</TableCell>
      <TableCell>{getStatusBadge(remote.status)}</TableCell>
      <TableCell>
        <RemoteTemplateLinkCell
          remote={remote}
          defaultSelected={defaultSelected}
          isLinked={isLinked}
          onSelectLocal={onSelectLocal}
          onLink={onLink}
          onImport={onImport}
          isLinking={isLinking}
          isImporting={isImporting}
          t={t}
        />
      </TableCell>
    </TableRow>
  );
}

function useRemoteTemplatesActions({
  activeConnectionId,
  remoteTemplates,
  linkMutation,
  importMutation,
  t,
}: {
  activeConnectionId?: string;
  remoteTemplates: RemoteTemplateItem[];
  linkMutation: ReturnType<typeof useLinkRemoteTemplate>;
  importMutation: ReturnType<typeof useImportRemoteTemplate>;
  t: (k: string) => string;
}) {
  const [syncingAll, setSyncingAll] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<Record<string, string>>({});

  const handleSelectLocal = (remoteId: string, localId: string) => {
    setSelectedMapping((prev) => ({ ...prev, [remoteId]: localId }));
  };

  const handleLink = async (remote: RemoteTemplateItem) => {
    const localTemplateId =
      selectedMapping[remote.providerTemplateId] ||
      remote.suggestedTemplates.find((s) => s.exactMatch)?.id ||
      remote.suggestedTemplates[0]?.id;

    if (!localTemplateId || !activeConnectionId) return;

    try {
      await linkMutation.mutateAsync({
        connectionId: activeConnectionId,
        payload: {
          remoteTemplateId: remote.providerTemplateId,
          templateId: localTemplateId,
        },
      });
      toast.success(t('remoteTemplateLinkSuccess'));
    } catch {
      // Toast de erro já é tratado pelo Collector
    }
  };

  const handleImport = async (remote: RemoteTemplateItem) => {
    if (!activeConnectionId) return;
    try {
      await importMutation.mutateAsync({
        connectionId: activeConnectionId,
        payload: {
          remoteTemplateId: remote.providerTemplateId,
        },
      });
      toast.success(t('remoteTemplateImportSuccess'));
    } catch {
      // Toast de erro já é tratado pelo Collector
    }
  };

  const handleSyncAll = async () => {
    if (!activeConnectionId || remoteTemplates.length === 0) return;
    setSyncingAll(true);
    try {
      await syncRemoteTemplates({
        remoteTemplates,
        activeConnectionId,
        linkMutation,
        importMutation,
      });
      toast.success(t('remoteTemplateSyncAllSuccess'));
    } catch {
      // Handled by collector
    } finally {
      setSyncingAll(false);
    }
  };

  return {
    syncingAll,
    selectedMapping,
    handleSelectLocal,
    handleLink,
    handleImport,
    handleSyncAll,
  };
}

function RemoteTemplatesConnectionSelector({
  metaConnections,
  activeConnectionId,
  onSelect,
  t,
}: {
  metaConnections: MessagingConnection[];
  activeConnectionId?: string;
  onSelect: (id: string) => void;
  t: TranslateFn;
}) {
  if (metaConnections.length <= 1) return null;
  return (
    <div className="flex items-center gap-3 py-2 border-b">
      <span className="text-sm font-medium">{t('selectConnection')}:</span>
      <Select value={activeConnectionId} onValueChange={onSelect}>
        <SelectTrigger className="w-[280px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {metaConnections.map((conn) => (
            <SelectItem key={conn.id} value={conn.id}>
              {connectionDisplayName(conn)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RemoteTemplatesTableContent({
  isLoading,
  remoteTemplates,
  selectedMapping,
  onSelectLocal,
  onLink,
  onImport,
  isLinking,
  isImporting,
  t,
}: {
  isLoading: boolean;
  remoteTemplates: RemoteTemplateItem[];
  selectedMapping: Record<string, string>;
  onSelectLocal: (remoteId: string, val: string) => void;
  onLink: (remote: RemoteTemplateItem) => void;
  onImport: (remote: RemoteTemplateItem) => void;
  isLinking: boolean;
  isImporting: boolean;
  t: (k: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <RefreshCw className="size-6 animate-spin" />
        <span>{t('remoteTemplatesLoading')}</span>
      </div>
    );
  }
  if (remoteTemplates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <AlertCircle className="size-6" />
        <span>{t('remoteTemplatesEmpty')}</span>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('remoteTemplateColName')}</TableHead>
          <TableHead className="w-24">{t('remoteTemplateColLang')}</TableHead>
          <TableHead className="w-28">{t('remoteTemplateColCategory')}</TableHead>
          <TableHead className="w-28">{t('remoteTemplateColStatus')}</TableHead>
          <TableHead>{t('remoteTemplateColLink')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {remoteTemplates.map((remote) => (
          <RemoteTemplateRow
            key={remote.providerTemplateId}
            remote={remote}
            selectedLocalId={selectedMapping[remote.providerTemplateId]}
            onSelectLocal={(val) => onSelectLocal(remote.providerTemplateId, val)}
            onLink={() => onLink(remote)}
            onImport={() => onImport(remote)}
            isLinking={isLinking}
            isImporting={isImporting}
            t={t}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function RemoteTemplatesDialogFooter({
  isLoading,
  isRefetching,
  syncingAll,
  hasUnlinked,
  onRefetch,
  onSyncAll,
  onClose,
  t,
}: {
  isLoading: boolean;
  isRefetching: boolean;
  syncingAll: boolean;
  hasUnlinked: boolean;
  onRefetch: () => void;
  onSyncAll: () => void;
  onClose: () => void;
  t: TranslateFn;
}) {
  return (
    <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefetch}
          disabled={isLoading || isRefetching || syncingAll}
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
          {t('reconcileStatus', { defaultValue: 'Atualizar' })}
        </Button>
        {hasUnlinked && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onSyncAll}
            disabled={isLoading || isRefetching || syncingAll}
          >
            <Sparkles className={`size-3.5 mr-1.5 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll
              ? t('remoteTemplateLinking')
              : t('remoteTemplateSyncAllBtn')}
          </Button>
        )}
      </div>
      <Button type="button" variant="outline" onClick={onClose}>
        {t('close')}
      </Button>
    </DialogFooter>
  );
}

export function RemoteTemplatesDialog({
  open,
  onOpenChange,
  approvalConnectionIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approvalConnectionIds: string[];
}) {
  const { t } = useTranslation('messaging');
  const { data: allConnections = [] } = useMessagingConnections();
  const linkMutation = useLinkRemoteTemplate();
  const importMutation = useImportRemoteTemplate();

  const metaConnections = allConnections.filter((c) =>
    approvalConnectionIds.includes(c.id),
  );

  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(() => {
    return metaConnections[0]?.id ?? '';
  });

  const activeConnectionId = selectedConnectionId || metaConnections[0]?.id;

  const {
    data: remoteTemplates = [],
    isLoading,
    isRefetching,
    refetch,
  } = useRemoteTemplates(activeConnectionId, open && Boolean(activeConnectionId));

  const {
    syncingAll,
    selectedMapping,
    handleSelectLocal,
    handleLink,
    handleImport,
    handleSyncAll,
  } = useRemoteTemplatesActions({
    activeConnectionId,
    remoteTemplates,
    linkMutation,
    importMutation,
    t,
  });

  const hasUnlinked = remoteTemplates.some((r) => !r.linkedTemplateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-5xl max-h-[88dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('remoteTemplatesTitle')}</DialogTitle>
          <DialogDescription>{t('remoteTemplatesDescription')}</DialogDescription>
        </DialogHeader>

        <RemoteTemplatesConnectionSelector
          metaConnections={metaConnections}
          activeConnectionId={activeConnectionId}
          onSelect={setSelectedConnectionId}
          t={t}
        />

        <div className="flex-1 overflow-auto border rounded-md my-2">
          <RemoteTemplatesTableContent
            isLoading={isLoading}
            remoteTemplates={remoteTemplates}
            selectedMapping={selectedMapping}
            onSelectLocal={handleSelectLocal}
            onLink={handleLink}
            onImport={handleImport}
            isLinking={linkMutation.isPending}
            isImporting={importMutation.isPending}
            t={t}
          />
        </div>

        <RemoteTemplatesDialogFooter
          isLoading={isLoading}
          isRefetching={isRefetching}
          syncingAll={syncingAll}
          hasUnlinked={hasUnlinked}
          onRefetch={() => refetch()}
          onSyncAll={handleSyncAll}
          onClose={() => onOpenChange(false)}
          t={t}
        />
      </DialogContent>
    </Dialog>
  );
}

