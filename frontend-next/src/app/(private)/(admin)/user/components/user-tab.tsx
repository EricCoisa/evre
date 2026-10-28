'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useUsers, useRoles, useDeleteUser } from '@/lib/actions/user/queries';
import { useMe } from '@/lib/actions/auth/queries';
import { DataTable } from '@/components/data-table';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { createUser, updateUser } from '@/lib/actions/user/api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { getUserColumns } from './user-columns';
import UsersRolesPage from './user-roles';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@/lib/actions/user/types';
import { ROLES } from '@/types/roles';
import Modal from '@/components/modal';
import { UserEditPage } from './user-edit';
import { Alive } from '@/lib/api/collector';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { buildTableQueryParams } from '@/lib/table-query-params';

export function UserTab() {
  const { t } = useTranslation('users');
  const queryClient = useQueryClient();
  const deleteUser = useDeleteUser();
  const { data: currentUser } = useMe();

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [viewingRoutesUser, setViewingRoutesUser] = useState<User | null>(null);
  const [isRoutesDialogOpen, setIsRoutesDialogOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const handleEdit = useCallback((user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  }, []);

  const handleViewRoutes = useCallback((user: User) => {
    setViewingRoutesUser(user);
    setIsRoutesDialogOpen(true);
  }, []);

  const queryParams = buildTableQueryParams(pagination, globalFilter, filters);

  const { data, error } = useUsers(queryParams);
  const { data: rolesData } = useRoles();

  const createUserSchema = useMemo(() =>
    z.object({
      email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
      password: z.string()
        .min(8, t('passwordMin'))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
          t('passwordRequirements')
        ),
      confirmPassword: z.string().min(8, t('confirmPasswordMin')),
      name: z.string().optional(),
      role: z.enum(ROLES).optional(),
    }).refine((data) => data.password === data.confirmPassword, {
      message: t('passwordsDoNotMatch'),
      path: ['confirmPassword'],
    }),
  [t]);

  // RolesData.value = UUID (for invite); role update needs name → map label→value
  const createUserFields = useMemo<FormBuilderField[]>(() => [
    { name: 'name', label: t('name'), placeholder: t('namePlaceholder'), description: t('nameDescription'), className: 'sm:col-span-2' },
    { name: 'email', label: t('email'), type: 'email', placeholder: t('emailPlaceholder'), description: t('emailDescription'), className: 'sm:col-span-2' },
    { name: 'password', label: t('password'), type: 'password', placeholder: t('passwordPlaceholder'), description: t('passwordDescription') },
    { name: 'confirmPassword', label: t('confirmPassword'), type: 'password', placeholder: t('confirmPasswordPlaceholder'), description: t('confirmPasswordDescription') },
    { name: 'role', label: t('role'), type: 'select', placeholder: t('rolePlaceholder'), description: t('roleDescription'), options: rolesData?.map(r => ({ value: r.label, label: r.label })) ?? [], className: 'sm:col-span-2' },
  ], [t, rolesData]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingUser) return;
    try {
      await deleteUser.mutateAsync(deletingUser.id);
      toast.success(t('deleteSuccess'));
    } catch {
      // Alive handles toast.error internally
    } finally {
      setDeletingUser(null);
    }
  }, [deleteUser, deletingUser, t]);

  // Reusa o PATCH /user/:id para inativar; reativar fica no modal de edição.
  const handleConfirmDeactivate = useCallback(async () => {
    if (!deactivatingUser) return;
    try {
      await Alive(() => updateUser(deactivatingUser.id, { status: 'INACTIVE' }))();
      toast.success(t('deactivateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch {
      // Alive handles toast.error internally
    } finally {
      setDeactivatingUser(null);
    }
  }, [deactivatingUser, queryClient, t]);

  const columns = useMemo(() =>
    getUserColumns({ t, onEdit: handleEdit, onViewRoutes: handleViewRoutes, onDelete: setDeletingUser, onDeactivate: setDeactivatingUser, currentUserId: currentUser?.id }),
    [t, handleEdit, handleViewRoutes, currentUser?.id]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['users', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('noUsers')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />
        <DataTable.Select
          title={t('function')}
          accessorKey="role"
          placeholder={t('function')}
        />
        <DataTable.Select
          title={t('status')}
          accessorKey="status"
          placeholder={t('status')}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button id="btn-new-user" onClick={() => setIsCreateUserOpen(true)}>
            <Plus /> {t('newUser')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <FormBuilderModal
        size="lg"
        gridClassName="grid gap-4 sm:grid-cols-2"
        open={isCreateUserOpen}
        onOpenChange={setIsCreateUserOpen}
        title={t('createNewUser')}
        description={t('createUserDescription')}
        schema={createUserSchema}
        fields={createUserFields}
        values={{ role: 'USER' as const }}
        onSubmit={async (data) => {
          const result = await Alive(() => createUser(data))();
          return result;
        }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
        submitLabel={t('createUserButton')}
      />

      <Modal
        size="lg"
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingUser(null);
        }}
        title={editingUser ? t('editUserTitle', { name: editingUser.name || editingUser.email }) : t('editUser')}
        description={t('editUserDescription')}
      >
        <UserEditPage user={editingUser} onCancel={() => setIsEditDialogOpen(false)} />
      </Modal>

      {viewingRoutesUser && (
        <Modal
          size="2xl"
          title={t('manageUserRoutes')}
          description={t('manageUserRoutesDesc', { name: viewingRoutesUser.name || viewingRoutesUser.email })}
          open={isRoutesDialogOpen}
          onOpenChange={(open) => {
            setIsRoutesDialogOpen(open);
            if (!open) setViewingRoutesUser(null);
          }}
        >
          <UsersRolesPage user={viewingRoutesUser} />
        </Modal>
      )}

      <ConfirmDialog
        open={!!deactivatingUser}
        onOpenChange={(v) => !v && setDeactivatingUser(null)}
        onConfirm={handleConfirmDeactivate}
        title={t('deactivateConfirmTitle')}
        description={t('deactivateConfirmDescription')}
      />

      <ConfirmDialog
        open={!!deletingUser}
        onOpenChange={(v) => !v && setDeletingUser(null)}
        onConfirm={handleConfirmDelete}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDescription')}
      />
    </>
  );
}
