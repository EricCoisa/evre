'use client';

import { useTranslation } from "@/hooks/use-translation";
import type { Company } from "@/lib/actions/company/types";
import { CompanyEdit } from "../../components/company-edit";

interface CompanyConfigTabProps {
  company: Company;
}

/** Aba configuração: dados cadastrais da empresa seguidos da lista de contatos, ambos reusados da listagem. */
export function CompanyConfigTab({ company }: CompanyConfigTabProps) {
  const { t } = useTranslation('company');

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">{t('tabData')}</h3>
        <CompanyEdit company={company} />
      </div>
    </div>
  );
}
