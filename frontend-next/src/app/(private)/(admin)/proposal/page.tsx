'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useProposals, useSendProposal, useApproveProposal, useDeleteProposal } from '@/lib/actions/proposal/queries';
import { useCompanies } from '@/lib/actions/company/queries';
import { DataTable } from '@/components/data-table';
import { GenericCreateFormModal } from '@/components/generic-create-form';
import { createProposal } from '@/lib/actions/proposal/api';
import { Button } from '@/components/ui/button';
import { Plus, Copy, Check, Sparkles } from 'lucide-react';
import { Container } from '@/components/container';
import type { Proposal } from '@/lib/actions/proposal/types';
import { useState, useMemo, useCallback } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { FieldConfig } from '@/lib/form/field-config';
import { Alive } from '@/lib/api/collector';
import Modal from '@/components/modal';
import { getProposalColumns } from './components/proposal-columns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { promptTemplate } from '@/lib/actions/proposal/promptText';

export default function ProposalsPage() {
  const { t } = useTranslation('proposal');
  const queryClient = useQueryClient();
  const router = useRouter();

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const [deletingProposal, setDeletingProposal] = useState<Proposal | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const sendProposalMutation = useSendProposal();
  const approveProposalMutation = useApproveProposal();

  // Busca todas as empresas para o select
  const { data: companiesData } = useCompanies({ pagination: false });
  const deleteProposalMutation = useDeleteProposal();

  const companyOptions = useMemo(() => {
    if (!companiesData || Array.isArray(companiesData)) {
      const companies = companiesData || [];
      return companies.map(company => ({
        value: company.id,
        label: company.name
      }));
    }
    return [];
  }, [companiesData]);

  const handleView = useCallback((proposal: Proposal) => {
    router.push(`/proposal/${proposal.id}`);
  }, [router]);

  const handleSend = useCallback(async (proposal: Proposal) => {
    try {
      await sendProposalMutation.mutateAsync(proposal.id);
      toast.success(t('proposalSentSuccess') || 'Proposta enviada com sucesso!');
    } catch (error) {
      toast.error(t('proposalSentError') || 'Erro ao enviar proposta');
    }
  }, [sendProposalMutation, t]);

  const handleApprove = useCallback(async (proposal: Proposal) => {
    try {
      await approveProposalMutation.mutateAsync(proposal.id);
      toast.success(t('proposalApprovedSuccess') || 'Proposta aprovada com sucesso!');
    } catch (error) {
      toast.error(t('proposalApprovedError') || 'Erro ao aprovar proposta');
    }
  }, [approveProposalMutation, t]);

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

  const { data, error } = useProposals(queryParams);

  const createProposalSchema = useMemo(() =>
    z.object({
      companyId: z.string().uuid(t('companyIdRequired') || 'ID da empresa inválido'),
      name: z.string().min(1, t('nameRequired') || 'Nome obrigatório'),
      content: z.string().min(1, t('contentRequired') || 'Conteúdo obrigatório'),
      contentSchemaVersion: z.string().optional().default('v1'),
    }),
    [t]);

  const proposalFieldConfig = useMemo(() => ({
    companyId: {
      label: t('companyId') || 'ID da Empresa',
      placeholder: t('companyIdPlaceholder') || 'Selecione uma empresa',
      description: t('companyIdDescription') || 'Empresa para a proposta',
      type: 'select' as const,
      options: companyOptions,
    },
    name: {
      label: t('name') || 'Nome',
      placeholder: t('namePlaceholder') || 'Digite o nome da proposta',
      description: t('nameDescription') || 'Nome da proposta',
    },
    content: {
      label: t('content') || 'Conteúdo',
      placeholder: t('contentPlaceholder') || 'Digite o conteúdo JSON',
      description: t('contentDescription') || 'Conteúdo da proposta em formato JSON',
      type: 'textarea' as const,
    },
    contentSchemaVersion: {
      label: t('version') || 'Versão',
      placeholder: t('versionPlaceholder') || 'v1',
      description: t('versionDescription') || 'Versão do schema de conteúdo',
    },
  } satisfies FieldConfig<typeof createProposalSchema>), [t, companyOptions]);

  const handleDelete = useCallback((item: Proposal) => {
    setDeletingProposal(item);
    setIsDeleteDialogOpen(true);
  }, []);

  const columns = useMemo(() =>
    getProposalColumns({
      t,
      onView: handleView,
      onSend: handleSend,
      onApprove: handleApprove,
      onDelete: handleDelete
    }),
    [t, handleView, handleSend, handleApprove, handleDelete]
  );

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptTemplate);
      setCopied(true);
      toast.success('Prompt copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar prompt');
    }
  };
  const [llmOpen, setLlmOpen] = useState(false);



  return (
    <Container variant="dataTable" border={false}>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['proposals', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchPlaceholder') || 'Buscar propostas...'}
        loadingMessage={t('loading') || 'Carregando...'}
        emptyMessage={t('noProposals') || 'Nenhuma proposta encontrada'}
        entityName={t('entity') || 'proposta'}
        entityNamePlural={t('entityPlural') || 'propostas'}
      >
        <DataTable.Input
          title={t('searchText') || 'Buscar'}
          placeholder={t('searchPlaceholder') || 'Buscar propostas...'}
        />
        <DataTable.Select
          title={t('status') || 'Status'}
          accessorKey="status"
          placeholder={t('filterByStatus') || 'Filtrar por status'}
        />
        <DataTable.Select
          title={t('company') || 'Empresa'}
          accessorKey="companies"
          placeholder={t('filterByCompany') || 'Filtrar por empresa'}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">

          <Button variant="outline" onClick={() => setLlmOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Prompt LLM
          </Button>

          <GenericCreateFormModal
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('newProposal') || 'Nova Proposta'}
              </Button>
            }
            closeOnsuccess={true}
            title={t('newProposal') || 'Nova Proposta'}
            description={t('newProposalDescription') || 'Crie uma nova proposta para uma empresa'}
            schema={createProposalSchema}
            fieldConfig={proposalFieldConfig}
            onSubmit={async (data) => {
              const result = await Alive(() => createProposal(data))();
              return result;
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['proposals'] });
            }}
            onError={(error) => {
              console.error('Erro ao criar proposta:', error);
            }}
            submitLabel={t('create') || 'Criar'}
          />
        </DataTable.Actions>
      </DataTable>

      <Modal
        title='Prompt para LLM - Criar Proposta'
        description={`Copie este prompt e envie para uma IA (ChatGPT, Claude, etc) para gerar o JSON da proposta`}
        open={llmOpen}
        onOpenChange={(open) => {
          setLlmOpen(open);
        }}
      >

        <Textarea
          value={promptTemplate}
          readOnly
          rows={20}
          className="font-mono text-xs resize-none"
        />
        <Button onClick={handleCopyPrompt} className="w-full">
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copiar Prompt
            </>
          )}
        </Button>
      </Modal>

        {/* Modal de confirmação de exclusão */}
      <Modal
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setDeletingProposal(null);
        }}
        title={t('deleteConfirm') || 'Confirm deletion'}
        description={deletingProposal ? `${t('deleteConfirmDescription')} "${deletingProposal.name}"?` : ''}
      >
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setIsDeleteDialogOpen(false);
              setDeletingProposal(null);
            }}
          >
            {t('cancel') || 'Cancel'}
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              deleteProposalMutation.mutateAsync(deletingProposal!.id)
              setIsDeleteDialogOpen(false);
              setDeletingProposal(null);
            }}
          >
            {t('delete') || 'Delete'}
          </Button>
        </div>
      </Modal>

    </Container>
  );
}

