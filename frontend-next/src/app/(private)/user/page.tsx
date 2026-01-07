'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useUsers, useRoles } from '@/lib/actions/user/queries';
import { DataTable } from '@/components/data-table';
import { GenericCreateFormModal } from '@/components/generic-create-form';
import { createInvite, createUser } from '@/lib/actions/user/api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getUserColumns } from './components/user-columns';
import UsersRolesPage from './components/user-roles';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { FieldConfig } from '@/lib/form/field-config';
import type { User } from '@/lib/actions/user/types';
import { ROLES } from '@/types/roles';
import Modal from '@/components/modal';
import { UserEditPage } from './components/user-edit';
import { Container } from '@/components/container';
import { Alive } from '@/lib/api/collector';

export default function UsersPage() {
  const { t } = useTranslation('users');

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewingRoutesUser, setViewingRoutesUser] = useState<User | null>(null);
  const [isRoutesDialogOpen, setIsRoutesDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleEdit = useCallback((user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  }, []);

  const handleViewRoutes = useCallback((user: User) => {
    setViewingRoutesUser(user);
    setIsRoutesDialogOpen(true);
  }, []);

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

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

  const userFieldConfig = useMemo(() => ({
    email: {
      label: t('email'),
      type: 'email' as const,
      placeholder: t('emailPlaceholder'),
      description: t('emailDescription'),
    },
    password: {
      label: t('password'),
      type: 'password' as const,
      placeholder: t('passwordPlaceholder'),
      description: t('passwordDescription'),
    },
    confirmPassword: {
      label: t('confirmPassword'),
      type: 'password' as const,
      placeholder: t('confirmPasswordPlaceholder'),
      description: t('confirmPasswordDescription'),
    },
    name: {
      label: t('name'),
      placeholder: t('namePlaceholder'),
      description: t('nameDescription'),
    },
    role: {
      label: t('role'),
      placeholder: t('rolePlaceholder'),
      description: t('roleDescription'),
      options: rolesData || [],
    },
  } satisfies FieldConfig<typeof createUserSchema>), [rolesData, t]);


  const columns = useMemo(() =>
    getUserColumns({ t, onEdit: handleEdit, onViewRoutes: handleViewRoutes }),
    [t, handleEdit, handleViewRoutes]
  );



  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const handleCloseInvitationModal = () => {
    setInvitationToken(null);
  }

  const createInviteSchema = useMemo(() => z.object({
    email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
    role: z.enum(ROLES).optional(),
  }), [t]);

  const userInviteFieldConfig = useMemo(() => ({
    email: {
      label: t('email'),
      type: 'email' as const,
      placeholder: t('emailPlaceholder'),
      description: t('emailDescription'),
    },
    role: {
      label: t('role'),
      placeholder: t('rolePlaceholder'),
      description: t('roleDescription'),
      options: rolesData || [],
    },
  } satisfies FieldConfig<typeof createUserSchema>), [rolesData, t]);


  return (
    <Container variant="dataTable" border={false}>
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
        loadingMessage={t('loading')}
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
          placeholder="Filtrar por Status"
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <GenericCreateFormModal
            trigger={
              <Button>
                <Plus /> {t('newUser')}
              </Button>
            }
            closeOnsuccess={true}
            title={t('createNewUser')}
            description={t('createUserDescription')}
            schema={createUserSchema}
            fieldConfig={userFieldConfig}
            onSubmit={async (data) => {
              const result = await Alive(() => createUser(data))();
              return result;
            }}
            onSuccess={() => {
              // Invalida a query para recarregar a lista
              queryClient.invalidateQueries({ queryKey: ['users'] });
            }}
            onError={(error) => {
              console.error('Erro ao criar usuário:', error);
            }}
            submitLabel={t('createUserButton')}
            defaultValues={{
              role: 'USER',
            }}
          />

          <GenericCreateFormModal
            trigger={
              <Button>
                <Plus /> {t('newInvite')}
              </Button>
            }
            closeOnsuccess={true}
            title={t('createNewInvite')}
            description={t('createInviteDescription')}
            schema={createInviteSchema}
            fieldConfig={userInviteFieldConfig}
            onSubmit={async (data) => {
              const result = await Alive(() => createInvite(data))();
              return result;
            }}
            onSuccess={(success) => {
              setInvitationToken((success as { actionUrl: string }).actionUrl);
            }}
            onError={(error) => {
              console.error('Erro ao criar usuário:', error);
            }}
            submitLabel={t('createInviteButton')}
            defaultValues={{
              role: 'USER',
            }}
          />
        </DataTable.Actions>
      </DataTable>
      {/* Formulário de edição de usuário */}
      <Modal
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingUser(null);
        }}
        title={editingUser ? `Editar ${editingUser.name || editingUser.email}` : 'Editar Usuário'}
        description="Preencha os dados para modificar o usuário no sistema."
      >
        <UserEditPage user={editingUser} onCancel={() => setIsEditDialogOpen(false)} />
      </Modal>



      {/* Modal de rotas do usuário */}
      {viewingRoutesUser && (
        <Modal
          title='Gerenciar Rotas do Usuário'
          description={`Gerencie as rotas de acesso para ${viewingRoutesUser.name || viewingRoutesUser.email}`}
          open={isRoutesDialogOpen}
          onOpenChange={(open) => {
            setIsRoutesDialogOpen(open);
            if (!open) setViewingRoutesUser(null);
          }}

        >
          <UsersRolesPage
            user={viewingRoutesUser}
          />
        </Modal>

      )}


      {/* Modal de InvitationToken */}
      {invitationToken && (
        <Modal
          title="Token de Convite Criado"
          description="Token gerado"
          open={invitationToken !== null}
          onOpenChange={(open) => {
            if (!open) handleCloseInvitationModal();
          }}
        >
          <Container>
            <div className="flex items-center gap-2">
              <Input readOnly value={invitationToken ?? ''} />
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invitationToken ?? '');
                    toast.success('Token copiado');
                  } catch (e) {
                    toast.error('Falha ao copiar');
                  }
                }}
              >
                <Copy className="size-4 mr-2" /> Copiar
              </Button>
            </div>
          </Container>
        </Modal>
      )}
    </Container>
  );
}
