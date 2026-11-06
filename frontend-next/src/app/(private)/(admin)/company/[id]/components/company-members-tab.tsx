'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { useCompanyMembers, useCompanyInvites, useAddCompanyMember, useInviteCompanyMember, useRemoveCompanyMember, useUpdateCompanyMember } from '@/lib/actions/company/queries';
import { useUsers } from '@/lib/actions/user/queries';
import { useMe } from '@/lib/actions/auth/queries';
import { deleteInvite, updateUser } from '@/lib/actions/user/api';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Mail, UserPlus } from 'lucide-react';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Alive } from '@/lib/api/collector';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { buildTableQueryParams } from '@/lib/table-query-params';
import { getMemberColumns, type Member } from './member-columns';
import { getCompanyInviteColumns, type CompanyInvite } from './company-invite-columns';
import Modal from '@/components/modal';
import { CopyField } from '@/components/copy-field';
import { CapabilityGate } from '@/components/capability-gate';
import { useCapability } from '@/lib/actions/capability/queries';
import { CAPABILITIES } from '@/types/capabilities';

export function CompanyMembersTab({ companyId }: { companyId: string }) {
  const { t } = useTranslation('company');
  const queryClient = useQueryClient();
  const { data: currentUser } = useMe();
  const emailOperational = !useCapability(CAPABILITIES.email).disabled;

  const [membersPagination, setMembersPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [invitesPagination, setInvitesPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deactivatingMember, setDeactivatingMember] = useState<Member | null>(null);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);

  const [deletingInvite, setDeletingInvite] = useState<CompanyInvite | null>(null);
  const [resendingInvite, setResendingInvite] = useState<CompanyInvite | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  const queryParams = buildTableQueryParams(membersPagination, globalFilter, filters);
  const { data: membersData, error: membersError } = useCompanyMembers(companyId, queryParams);
  const { data: invitesData, error: invitesError } = useCompanyInvites(companyId);
  const { data: usersData } = useUsers({ limit: 200, pagination: false });
  const addMutation = useAddCompanyMember(companyId);
  const inviteMutation = useInviteCompanyMember(companyId);
  const removeMutation = useRemoveCompanyMember(companyId);
  const updateMemberMutation = useUpdateCompanyMember(companyId);

  const members: Member[] = useMemo(() => {
    if (!membersData) return [];
    return Array.isArray(membersData) ? membersData : membersData.data ?? [];
  }, [membersData]);

  const allInvites: CompanyInvite[] = invitesData ?? [];
  const invites = useMemo(() => allInvites.filter((i) => !i.usedAt), [allInvites]);

  const existingMemberUserIds = useMemo(
    () => new Set(members.map((m) => m.userId)),
    [members],
  );

  const availableUsers = useMemo(() => {
    const allUsers = Array.isArray(usersData) ? usersData : usersData?.data ?? [];
    return allUsers
      .filter((u) => {
        const role = u.role ?? '';
        return (role === 'ADMIN' || role === 'MODERATOR') && !existingMemberUserIds.has(u.id);
      })
      .map((u) => ({ value: u.id, label: `${u.name ?? u.email} (${u.role ?? ''})` }));
  }, [usersData, existingMemberUserIds]);

  const addSchema = useMemo(() => z.object({
    userId: z.string().uuid(),
    canSeeCommercials: z.boolean().optional(),
    canComment: z.boolean().optional(),
  }), []);

  const addFields = useMemo<FormBuilderField[]>(() => [
    { name: 'userId', label: t('members.user'), type: 'select', placeholder: t('members.userPlaceholder'), options: availableUsers },
    { name: 'canSeeCommercials', label: t('members.canSeeCommercials'), type: 'checkbox' },
    { name: 'canComment', label: t('members.canComment'), type: 'checkbox' },
  ], [t, availableUsers]);

  const inviteSchema = useMemo(() => z.object({
    email: z.string().min(1).email(),
    name: z.string().max(200).optional(),
  }), []);

  const inviteFields = useMemo<FormBuilderField[]>(() => [
    { name: 'email', label: t('members.email'), type: 'email', placeholder: t('members.emailPlaceholder') },
    { name: 'name', label: t('members.name'), placeholder: t('members.namePlaceholder') },
  ], [t]);

  const editPermissionsSchema = useMemo(() => z.object({
    canSeeCommercials: z.boolean().optional(),
    canComment: z.boolean().optional(),
  }), []);

  const editPermissionsFields = useMemo<FormBuilderField[]>(() => [
    { name: 'canSeeCommercials', label: t('members.canSeeCommercials'), type: 'checkbox' },
    { name: 'canComment', label: t('members.canComment'), type: 'checkbox' },
  ], [t]);

  const handleConfirmDeactivate = useCallback(async () => {
    if (!deactivatingMember) return;
    try {
      await Alive(() => updateUser(deactivatingMember.user.id, { status: 'INACTIVE' }))();
      toast.success(t('members.deactivateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'members'] });
    } finally {
      setDeactivatingMember(null);
    }
  }, [deactivatingMember, queryClient, companyId, t]);

  const handleConfirmRemove = useCallback(async () => {
    if (!removingMember) return;
    try {
      await removeMutation.mutateAsync(removingMember.id);
    } finally {
      setRemovingMember(null);
    }
  }, [removeMutation, removingMember]);

  const handleShowLink = useCallback((invite: CompanyInvite) => {
    if (invite.actionUrl) {
      setInvitationToken(invite.actionUrl);
    } else {
      toast.info(t('members.inviteNoLinkYet'));
    }
  }, [t]);

  const handleResend = useCallback((invite: CompanyInvite) => {
    setResendingInvite(invite);
  }, []);

  const handleConfirmResend = useCallback(async () => {
    if (!resendingInvite) return;
    const invite = resendingInvite;
    setResendingInvite(null);
    try {
      const result = await Alive(() => inviteMutation.mutateAsync({ email: invite.email }))();
      if (result?.actionUrl) {
        setInvitationToken(result.actionUrl);
      }
    } catch {
      // Alive handles toast.error
    }
  }, [resendingInvite, inviteMutation]);

  const handleConfirmDeleteInvite = useCallback(async () => {
    if (!deletingInvite) return;
    try {
      await Alive(() => deleteInvite(deletingInvite.id))();
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'invites'] });
      toast.success(t('members.deleteInviteSuccess'));
    } finally {
      setDeletingInvite(null);
    }
  }, [deletingInvite, queryClient, companyId, t]);

  const memberColumns = useMemo(
    () => getMemberColumns({ t, onEdit: setEditingMember, onDeactivate: setDeactivatingMember, onRemove: setRemovingMember, currentUserId: currentUser?.id }),
    [t, currentUser?.id],
  );

  const inviteColumns = useMemo(
    () => getCompanyInviteColumns({ t, onShowLink: handleShowLink, onResend: handleResend, onDelete: setDeletingInvite, emailOperational }),
    [t, handleShowLink, handleResend, emailOperational],
  );

  return (
    <>
      <DataTable
        columns={memberColumns}
        data={membersData}
        error={membersError}
        queryKey={['company', companyId, 'members', queryParams]}
        pagination={membersPagination}
        onPaginationChange={setMembersPagination}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        enableGlobalFilter={true}
        searchPlaceholder={t('members.searchPlaceholder')}
        emptyMessage={t('members.empty')}
        entityName={t('members.entity')}
        entityNamePlural={t('members.entityPlural')}
      >
        <DataTable.Input
          title={t('members.name')}
          placeholder={t('members.searchPlaceholder')}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button variant="outline" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" />
            {t('members.addExisting')}
          </Button>
          <CapabilityGate name={CAPABILITIES.email}>
            <Button onClick={() => setIsInviteOpen(true)}>
              <Mail className="mr-1 h-4 w-4" />
              {t('members.inviteClient')}
            </Button>
          </CapabilityGate>
        </DataTable.Actions>
      </DataTable>

      {invites.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium mb-4">{t('members.pendingInvites')}</h3>
          <DataTable
            columns={inviteColumns}
            data={invites}
            error={invitesError}
            queryKey={['company', companyId, 'invites']}
            pagination={invitesPagination}
            onPaginationChange={setInvitesPagination}
            enableGlobalFilter={true}
            searchPlaceholder={t('members.searchInvitesPlaceholder')}
            emptyMessage={t('members.noInvites')}
            entityName={t('members.inviteEntity')}
            entityNamePlural={t('members.inviteEntityPlural')}
          >
            <DataTable.Input
              title={t('members.email')}
              placeholder={t('members.searchInvitesPlaceholder')}
            />
          </DataTable>
        </div>
      )}

      <FormBuilderModal
        size="md"
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title={t('members.addTitle')}
        description={t('members.addDescription')}
        schema={addSchema}
        fields={addFields}
        mode="create"
        onSubmit={async (data) => {
          const result = await Alive(() => addMutation.mutateAsync(data))();
          return result;
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['company', companyId, 'members'] });
        }}
        submitLabel={t('members.addExisting')}
      />

      <FormBuilderModal
        size="md"
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        title={t('members.inviteTitle')}
        description={t('members.inviteDescription')}
        schema={inviteSchema}
        fields={inviteFields}
        mode="create"
        onSubmit={async (data) => {
          const result = await Alive(() => inviteMutation.mutateAsync(data))();
          return result;
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['company', companyId, 'members'] });
          queryClient.invalidateQueries({ queryKey: ['company', companyId, 'invites'] });
        }}
        submitLabel={t('members.inviteClient')}
      />

      <FormBuilderModal
        size="md"
        open={!!editingMember}
        onOpenChange={(open) => { if (!open) setEditingMember(null); }}
        title={editingMember ? t('members.editTitle', { name: editingMember.user.name || editingMember.user.email }) : t('members.editTooltip')}
        description={t('members.editDescription')}
        schema={editPermissionsSchema}
        fields={editPermissionsFields}
        mode="edit"
        values={editingMember ? { canSeeCommercials: editingMember.canSeeCommercials, canComment: editingMember.canComment } : undefined}
        onSubmit={async (data) => {
          if (!editingMember) return;
          await Alive(() => updateMemberMutation.mutateAsync({ membershipId: editingMember.id, data }))();
        }}
        onSuccess={() => {
          setEditingMember(null);
        }}
        submitLabel={t('save')}
      />

      <ConfirmDialog
        open={!!deactivatingMember}
        onOpenChange={(v) => !v && setDeactivatingMember(null)}
        onConfirm={handleConfirmDeactivate}
        title={t('members.deactivateConfirm')}
        description={t('members.deactivateConfirmDescription')}
      />

      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(v) => !v && setRemovingMember(null)}
        onConfirm={handleConfirmRemove}
        title={t('members.removeConfirm')}
        description={t('members.removeConfirmDescription')}
      />

      <ConfirmDialog
        open={!!resendingInvite}
        onOpenChange={(v) => !v && setResendingInvite(null)}
        onConfirm={handleConfirmResend}
        title={t('members.resendInviteTitle')}
        description={t('members.resendInviteDescription', { email: resendingInvite?.email ?? '' })}
      />

      <ConfirmDialog
        open={!!deletingInvite}
        onOpenChange={(v) => !v && setDeletingInvite(null)}
        onConfirm={handleConfirmDeleteInvite}
        title={t('members.deleteInvite')}
        description={t('members.deleteInviteConfirm')}
      />

      {invitationToken && (
        <Modal
          title={t('members.inviteLinkTitle')}
          description={t('members.inviteLinkDescription')}
          open={invitationToken !== null}
          onOpenChange={(open) => { if (!open) setInvitationToken(null); }}
        >
          <CopyField value={invitationToken ?? ''} />
        </Modal>
      )}
    </>
  );
}
