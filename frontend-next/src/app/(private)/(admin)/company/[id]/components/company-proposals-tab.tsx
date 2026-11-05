'use client';

import { ProposalTab } from "../../../proposal/components/proposal-tab";

interface CompanyProposalsTabProps {
  companyId: string;
}

/** Aba propostas: reusa a tela `/proposal` filtrada (e com criação travada) na empresa. */
export function CompanyProposalsTab({ companyId }: CompanyProposalsTabProps) {
  return <ProposalTab companyId={companyId} />;
}
