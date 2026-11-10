'use client';

import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import { useCompanies } from '@/lib/actions/company/queries';
import { useUpdateProposal } from '@/lib/actions/proposal/queries';
import type { Proposal } from '@/lib/actions/proposal/types';

// Mesmo sentinel do diálogo de criação: Radix não aceita `value=""` num `SelectItem`.
const NO_COMPANY = '__none__';

/** Empresa é metadado de CRM, não parte do conteúdo congelado em `ProposalVersion` — por isso é
 * editável em qualquer status, diferente do conteúdo/comercial (que só edita em DRAFT). Fica no
 * cabeçalho do detalhe porque "a quem pertence" não é específico de nenhuma aba. */
export function ProposalCompanyField({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation('proposal');
  const { data: companiesData } = useCompanies({ pagination: false });
  const companies = Array.isArray(companiesData) ? companiesData : companiesData?.data ?? [];
  const updateProposal = useUpdateProposal();

  function handleChange(value: string) {
    const companyId = value === NO_COMPANY ? null : value;
    updateProposal.mutate(
      { id: proposal.id, data: { companyId } },
      { onError: () => toast.error(t('companyUpdateFailed')) },
    );
  }

  return (
    <Select value={proposal.companyId ?? NO_COMPANY} onValueChange={handleChange} disabled={updateProposal.isPending}>
      <SelectTrigger size="sm" className="w-auto max-w-[260px] border-none shadow-none px-0 h-auto text-sm text-muted-foreground">
        <SelectValue placeholder={t('companyPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_COMPANY}>{t('noCompany')}</SelectItem>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
