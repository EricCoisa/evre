'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useProjects } from '@/lib/actions/project/queries';
import { useCompanies } from '@/lib/actions/company/queries';
import { Button } from '@/components/ui/button';
import { Copy, Plus } from 'lucide-react';
import { getProjectColumns } from './project-columns';
import { DataTable } from '@/components/data-table';
import { Container } from '@/components/container';
import Modal from '@/components/modal';
import { ProjectCreate } from './project-create';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { GenericCreateFormModal } from '@/components/generic-create-form';
import type { FieldConfig } from '@/lib/form/field-config';
import z from 'zod';
import { Alive } from '@/lib/api/collector';
import { createCompanyInvite } from '@/lib/actions/user/api';

interface ProjectListProps {
  companyId?: string;
  showCreateInviteButton?: boolean;
  showCompanyFilter?: boolean;
}

export function ProjectList({
  companyId,
  showCreateInviteButton = false,
  showCompanyFilter = true
}: ProjectListProps) {
  const { t } = useTranslation('projects');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(
    companyId ? { companyId } : {}
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

  const { data, error } = useProjects(queryParams);

  const columns = useMemo(() => getProjectColumns({ t }), [t]);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateDialogOpen(false);
  }, []);


  const createInviteSchema = useMemo(() => z.object({
    companyId: z.string().min(1, t('companyRequired')),
    email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
    name: z.string().optional()
  }), [t]);

  const userInviteFieldConfig = useMemo(() => ({
    companyId: {
      disabled: true
    },
    email: {
      label: t('email'),
      type: 'email' as const,
      placeholder: t('emailPlaceholder'),
      description: t('emailDescription'),
    },
    name: {
      label: t('name'),
      placeholder: t('namePlaceholder'),
      description: t('nameDescription'),
    },
    // companyId propositalmente omitido do config para não aparecer no formulário
  } satisfies FieldConfig<typeof createInviteSchema>), [t]);


  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const handleCloseInvitationModal = () => {
    setInvitationToken(null);
  }

  return (
    <>
      <Container variant="dataTable" border={false}>
        <DataTable
          columns={columns}
          data={data}
          error={error}
          queryKey={['projects', queryParams]}
          pagination={pagination}
          onPaginationChange={setPagination}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          filters={filters}
          onFiltersChange={setFilters}
          enableGlobalFilter={true}
          searchPlaceholder={t('searchPlaceholder')}
          loadingMessage={t('loading')}
          emptyMessage={t('noProjects')}
          entityName={t('entity')}
          entityNamePlural={t('entityPlural')}
        >
          <DataTable.Input
            title={t('searchText')}
            placeholder={t('searchPlaceholder')}
          />
          {showCompanyFilter && (
            <DataTable.Select
              title={t('company')}
              accessorKey="companyName"
              placeholder={t('selectCompany')}
            />
          )}
          <DataTable.Select
            title={t('status')}
            accessorKey="status"
            placeholder={t('filterByStatus')}
          />

          <DataTable.Actions className="sm:justify-end sm:w-full">
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('createProject')}
            </Button>

            {showCreateInviteButton && (
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
                  const result = await Alive(() => createCompanyInvite(data))();
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
                  companyId: companyId,
                }}
              />
            )}
          </DataTable.Actions>

        </DataTable>
      </Container>


      <Modal
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }
        }}
        title={t('createProject')}
        description={t('createProjectDescription')}
      >
        <ProjectCreate companyId={companyId} onSuccess={handleCreateSuccess} />
      </Modal>


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
        </Modal>)}

    </>
  );
}
