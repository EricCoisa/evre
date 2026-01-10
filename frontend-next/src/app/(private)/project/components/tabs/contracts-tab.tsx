"use client";
import { useTranslation } from "react-i18next";
import { useMemo, useCallback, useState } from "react";
import { useContractDocumentsByProject, useSendContractDocument, useAcceptContractDocument, useArchiveContractDocument } from "@/lib/actions/contract-document/queries";
import { getContractDocumentColumns } from "@/app/(private)/contract-document/components/contract-document-columns";
import { DataTable } from "@/components/data-table";
import { Container } from "@/components/container";
import type { Project } from "@/lib/actions/project/types";

interface ContractsTabProps {
  project: Project;
}

export function ContractsTab({ project }: ContractsTabProps) {
  const { t } = useTranslation("contractDocument");

  const sendContractMutation = useSendContractDocument();
  const acceptContractMutation = useAcceptContractDocument();
  const archiveContractMutation = useArchiveContractDocument();

  const { data, error } = useContractDocumentsByProject(project.id);

  const handleView = useCallback((contract: import("@/lib/actions/contract-document/types").ContractDocument) => {
    window.open(`/contract-document/${contract.id}`, "_blank");
  }, []);

  const handleSend = useCallback(async (contract: import("@/lib/actions/contract-document/types").ContractDocument) => {
    await sendContractMutation.mutateAsync(contract.id);
  }, [sendContractMutation]);

  const handleAccept = useCallback(async (contract: import("@/lib/actions/contract-document/types").ContractDocument) => {
    await acceptContractMutation.mutateAsync(contract.id);
  }, [acceptContractMutation]);

  const handleArchive = useCallback(async (contract: import("@/lib/actions/contract-document/types").ContractDocument) => {
    await archiveContractMutation.mutateAsync(contract.id);
  }, [archiveContractMutation]);

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const columns = useMemo(() => getContractDocumentColumns({
    t,
    onView: handleView,
    onSend: handleSend,
    onAccept: handleAccept,
    onArchive: handleArchive,
  }), [t, handleView, handleSend, handleAccept, handleArchive]);

  return (
    <Container>
      <DataTable
        columns={columns}
        data={data || []}
        error={error}
        queryKey={["contract-documents", "project", project.id]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        entityName={t("entity") ?? "contrato"}
        entityNamePlural={t("entityPlural") ?? "contratos"}
        loadingMessage={t("loading") ?? "Carregando..."}
        emptyMessage={t("noLogs") ?? "Nenhum contrato encontrado"}
      />
    </Container>
  );
}
