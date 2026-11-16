'use client';

import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/hooks/use-translation';
import { useLeads } from '@/lib/actions/lead/queries';
import { useCallback, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { getLeadColumns } from './components/lead-columns';
import { buildTableQueryParams } from '@/lib/table-query-params';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteLead, updateLeadStatus } from '@/lib/actions/lead/api';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { LeadDto, LeadDtoStatus } from '@/lib/generated/schemas';
import { useChatWindows } from '@/components/messaging/chat-windows-provider';
import { SendEmailDialog } from '@/components/send-email-dialog';
import { useCapability } from '@/lib/actions/capability/queries';
import { CAPABILITIES } from '@/types/capabilities';

export default function LeadPage() {
  const { t } = useTranslation('lead');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const queryParams = buildTableQueryParams(pagination, globalFilter, filters);
  const { data, error } = useLeads(queryParams);
  const queryClient = useQueryClient();

  const [emailTarget, setEmailTarget] = useState<{ email: string; name?: string; message?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadDto | null>(null);

  const { chatEnabled, openChatForPhone } = useChatWindows();
  const { disabled: messagingDisabled, reason: messagingDisabledReason } = useCapability(
    CAPABILITIES.messaging,
  );
  const { operational: emailOperational, reason: emailDisabledReason } = useCapability(
    CAPABILITIES.email,
  );

  const handleStatusChange = async (lead: LeadDto, status: LeadDtoStatus) => {
    const res = await updateLeadStatus(lead.id, { status });
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
    } else {
      toast.error(res.message ?? 'Erro ao atualizar status.');
    }
  };

  const handleOpenChat = useCallback(
    (lead: LeadDto) => {
      if (lead.phone) openChatForPhone(String(lead.phone), { name: lead.name ?? undefined });
    },
    [openChatForPhone],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteLead(deleteTarget.id);
    setDeleteTarget(null);
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
    } else {
      toast.error(res.message ?? t('deleteError'));
    }
  };

  const deleteTargetDisplayName = deleteTarget?.name ?? (deleteTarget?.email ? String(deleteTarget.email) : '');

  const handleSendEmail = useCallback((lead: LeadDto) => {
    if (lead.email) setEmailTarget({
      email: lead.email as unknown as string,
      name: lead.name ?? undefined,
      message: lead.message ?? undefined,
    });
  }, []);

  const columns = getLeadColumns({
    t,
    onStatusChange: handleStatusChange,
    onDelete: setDeleteTarget,
    onOpenChat: handleOpenChat,
    chatEnabled,
    chatOperational: !messagingDisabled,
    chatDisabledReason: messagingDisabledReason,
    onSendEmail: handleSendEmail,
    emailEnabled: true,
    emailOperational,
    emailDisabledReason,
  });

  return (
    <>
    <ConfirmDialog
      open={!!deleteTarget}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
      onConfirm={handleDelete}
      title={t('deleteConfirmTitle')}
      description={t('deleteConfirmDescription', { name: deleteTargetDisplayName })}
      confirmVariant="destructive"
    />
    <SendEmailDialog
      open={!!emailTarget}
      onOpenChange={(open) => !open && setEmailTarget(null)}
      defaultTo={emailTarget?.email}
      defaultTemplateType="LEAD_FOLLOWUP"
      defaultVars={{ name: emailTarget?.name ?? '', message: emailTarget?.message ?? '' }}
    />
    <Container variant="dataTable" border={false}>
      <PageHeader title={t('title')} description={t('description')} />
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['leads', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('noLeads')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input title={t('searchPlaceholder')} placeholder={t('searchPlaceholder')} />
        <DataTable.Select title={t('filterByStatus')} accessorKey="status" placeholder={t('filterByStatus')} />
      </DataTable>
    </Container>
    </>
  );
}
