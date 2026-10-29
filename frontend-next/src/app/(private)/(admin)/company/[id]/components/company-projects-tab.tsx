'use client';

import { useTranslation } from "@/hooks/use-translation";

/** Aba projetos: `Project` nasce em F2 — aqui só o estado vazio explícito, aba visível desde já. */
export function CompanyProjectsTab() {
  const { t } = useTranslation('company');

  return <p className="text-sm text-muted-foreground">{t('projectsEmpty')}</p>;
}
