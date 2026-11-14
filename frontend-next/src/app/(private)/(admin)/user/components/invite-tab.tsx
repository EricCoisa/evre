"use client";

import { useState, useCallback, useMemo } from 'react';
import { DataTable } from '@/components/data-table';
import { FormBuilder, type FormBuilderField } from '@/components/form/form-builder';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { useInvites, useDeleteInvite, useRoles } from '@/lib/actions/user/queries';
import { useCapability } from '@/lib/actions/capability/queries';
import { CAPABILITIES } from '@/types/capabilities';
import { createInvite } from '@/lib/actions/user/api';
import { toast } from 'sonner';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { Invite } from '@/lib/actions/user/types';
import { getInviteColumns, getInviteStatus } from './invite-columns';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CopyField } from '@/components/copy-field';
import Modal from '@/components/modal';

export function InviteTab() {
  const { t } = useTranslation('users');
  const { data, error } = useInvites();
  const { data: rolesData } = useRoles();
  const deleteInvite = useDeleteInvite();
  const emailOperational = !useCapability(CAPABILITIES.email).disabled;
  const messagingOperational = !useCapability(CAPABILITIES.messaging).disabled;
  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingInvite, setDeletingInvite] = useState<Invite | null>(null);
  const [resendingInvite, setResendingInvite] = useState<Invite | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  // filters
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Convites auto-gerados pelo signup orgânico (createdById null) não são "convites" do ponto
  // de vista do admin — esta tela lista só o que foi convidado por alguém.
  const adminInvites = useMemo(
    () => (data ?? []).filter((i) => i.createdById !== null),
    [data],
  );

  const uniqueRoles = useMemo(
    () => [...new Set(adminInvites.map((i) => i.roleName))],
    [adminInvites],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'PENDING', label: t('inviteStatusPending') },
      { value: 'USED', label: t('inviteStatusUsed') },
      { value: 'EXPIRED', label: t('inviteStatusExpired') },
    ],
    [t],
  );

  const roleOptions = useMemo(
    () => uniqueRoles.map((role) => ({ value: role, label: role })),
    [uniqueRoles],
  );

  const filteredData = useMemo(() => {
    return adminInvites.filter((invite) => {
      const status = getInviteStatus(invite);
      const matchStatus = !filters.status || filters.status === 'all' || status === filters.status;
      const matchRole = !filters.roleName || filters.roleName === 'all' || invite.roleName === filters.roleName;
      return matchStatus && matchRole;
    });
  }, [adminInvites, filters]);

  const createInviteSchema = useMemo(() => z.object({
    email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
    roleId: z.string().optional(),
  }), [t]);

  const createInviteFields = useMemo<FormBuilderField[]>(() => [
    { name: 'email', label: t('email'), type: 'email', placeholder: t('emailPlaceholder'), description: t('emailDescription') },
    { name: 'roleId', label: t('role'), type: 'select', placeholder: t('rolePlaceholder'), description: t('roleDescription'), options: rolesData || [] },
  ], [t, rolesData]);

  const createWaInviteSchema = useMemo(() => z.object({
    phone: z.string().min(1, t('phoneRequired')),
    name: z.string().min(1, t('nameRequired')).max(200),
    roleId: z.string().optional(),
  }), [t]);

  const createWaInviteFields = useMemo<FormBuilderField[]>(() => [
    { name: 'phone', label: t('phone'), type: 'phone', placeholder: t('phonePlaceholder') },
    { name: 'name', label: t('name'), placeholder: t('namePlaceholder') },
    { name: 'roleId', label: t('role'), type: 'select', placeholder: t('rolePlaceholder'), description: t('roleDescription'), options: rolesData || [] },
  ], [t, rolesData]);

  const handleResend = useCallback((invite: Invite) => {
    setResendingInvite(invite);
  }, []);

  const handleConfirmResend = useCallback(async () => {
    if (!resendingInvite) return;
    const invite = resendingInvite;
    setResendingInvite(null);
    const payload = invite.channel === 'WHATSAPP'
      ? { channel: 'WHATSAPP' as const, phone: invite.phone ?? undefined, roleId: invite.roleId }
      : { email: invite.email ?? undefined, roleId: invite.roleId };
    const result = await createInvite(payload);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      toast.success(t('invite_resent'));
    } else if (result.status === 409) {
      toast.info(t('invite_already_registered'));
    } else {
      toast.error(result.message ?? t('invite_resent_error'));
    }
  }, [resendingInvite, queryClient, t]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingInvite) return;
    try {
      await deleteInvite.mutateAsync(deletingInvite.id);
      toast.success(t('deleteInviteSuccess'));
    } finally {
      setDeletingInvite(null);
    }
  }, [deleteInvite, deletingInvite, t]);

  const handleShowLink = useCallback((invite: Invite) => {
    if (invite.actionUrl) {
      setInvitationToken(invite.actionUrl);
    } else {
      toast.info(t('inviteNoLinkYet'));
    }
  }, [t]);

  const columns = useMemo(
    () => getInviteColumns({ t, onResend: handleResend, onDelete: setDeletingInvite, onShowLink: handleShowLink, emailOperational, messagingOperational }),
    [t, handleResend, handleShowLink, emailOperational, messagingOperational],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredData}
        error={error}
        queryKey={['invites']}
        pagination={pagination}
        onPaginationChange={setPagination}
        filters={filters}
        onFiltersChange={setFilters}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchInvitesPlaceholder')}
        emptyMessage={t('noInvites')}
        entityName={t('inviteEntity')}
        entityNamePlural={t('inviteEntityPlural')}
      >
        <DataTable.Input
          title={t('email')}
          placeholder={t('searchInvitesPlaceholder')}
        />
        <DataTable.Select
          title={t('inviteStatus')}
          accessorKey="status"
          placeholder={t('inviteStatus')}
          options={statusOptions}
        />
        <DataTable.Select
          title={t('inviteRoleFilter')}
          accessorKey="roleName"
          placeholder={t('inviteRoleFilter')}
          options={roleOptions}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button id="btn-new-invite" onClick={() => setIsCreateOpen(true)}>
            <Plus /> {t('newInvite')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <Modal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={t('newInvite')}
      >
        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email">{t('inviteChannelEmail')}</TabsTrigger>
            <TabsTrigger value="whatsapp">
              {t('inviteChannelWhatsapp')}
              {!messagingOperational && <TriangleAlert className="size-3.5 text-amber-500" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <FormBuilder
              chrome="plain"
              schema={createInviteSchema}
              fields={createInviteFields}
              submitLabel={t('createInviteButton')}
              onSubmit={async (data) => {
                const result = await createInvite({ email: data.email, roleId: data.roleId });
                if (!result.success) throw new Error(result.message ?? t('invite_send_error'));
                return result.data;
              }}
              onSuccess={(data) => {
                setIsCreateOpen(false);
                queryClient.invalidateQueries({ queryKey: ['invites'] });
                setInvitationToken((data as { actionUrl: string }).actionUrl ?? null);
              }}
              onCancel={() => setIsCreateOpen(false)}
            />
          </TabsContent>

          <TabsContent value="whatsapp">
            {!messagingOperational && (
              <p className="flex items-center gap-1.5 text-sm text-amber-600 mb-3">
                <TriangleAlert className="size-4 shrink-0" />
                {t('whatsapp_service_disabled_hint')}
              </p>
            )}
            <FormBuilder
              chrome="plain"
              schema={createWaInviteSchema}
              fields={createWaInviteFields}
              submitLabel={t('createInviteButton')}
              onSubmit={async (data) => {
                const result = await createInvite({ channel: 'WHATSAPP', phone: data.phone, name: data.name, roleId: data.roleId });
                if (!result.success) throw new Error(result.message ?? t('invite_send_error'));
                return result.data;
              }}
              onSuccess={(data) => {
                setIsCreateOpen(false);
                queryClient.invalidateQueries({ queryKey: ['invites'] });
                setInvitationToken((data as { actionUrl: string }).actionUrl ?? null);
              }}
              onCancel={() => setIsCreateOpen(false)}
            />
          </TabsContent>
        </Tabs>
      </Modal>

      <ConfirmDialog
        open={!!resendingInvite}
        onOpenChange={(v) => !v && setResendingInvite(null)}
        onConfirm={handleConfirmResend}
        title={t('resendInviteTitle')}
        description={
          resendingInvite?.channel === 'WHATSAPP'
            ? t('resendInviteDescriptionWa', { phone: resendingInvite.phone ?? '' })
            : t('resendInviteDescription', { email: resendingInvite?.email ?? '' })
        }
      />

      <ConfirmDialog
        open={!!deletingInvite}
        onOpenChange={(v) => !v && setDeletingInvite(null)}
        onConfirm={handleConfirmDelete}
        title={t('deleteInviteTitle')}
        description={t('deleteInviteDescription')}
      />

      {invitationToken && (
        <Modal
          title={t('inviteTokenTitle')}
          description={t('inviteTokenDesc')}
          open={invitationToken !== null}
          onOpenChange={(open) => { if (!open) setInvitationToken(null); }}
        >
          <CopyField value={invitationToken ?? ''} />
        </Modal>
      )}
    </>
  );
}
