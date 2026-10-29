'use client';

import { useTranslation } from "@/hooks/use-translation";

/** Aba contratos: `Contract` nasce em F2 — aqui só o estado vazio explícito, aba visível desde já. */
export function CompanyContractsTab() {
  const { t } = useTranslation('company');

  return <p className="text-sm text-muted-foreground">{t('contractsEmpty')}</p>;
}
