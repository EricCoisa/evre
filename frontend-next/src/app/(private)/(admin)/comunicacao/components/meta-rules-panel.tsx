'use client';

import { AlertTriangle, XCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import type { MetaTemplateIssue } from '@/lib/actions/messaging/types';

/** Exibe os problemas de template apontados pelo servidor, traduzidos por código, com error bloqueando a submissão. */
export function MetaRulesPanel({
  issues,
  className,
}: {
  issues: MetaTemplateIssue[];
  className?: string;
}) {
  const { t } = useTranslation('messaging');
  if (issues.length === 0) return null;

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  // Código sem tradução (regra nova no servidor ainda sem rótulo no front) cai na mensagem do servidor.
  const text = (issue: MetaTemplateIssue) => {
    const key = `metaRule.${issue.code}`;
    const translated = t(key, (issue.params ?? {}) as Record<string, string | number>);
    return translated === key ? issue.message : translated;
  };

  return (
    <div className={`grid gap-2 text-sm ${className ?? ''}`} data-testid="meta-rules-panel">
      {errors.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="mb-1 font-medium text-destructive">{t('metaRulesErrorsTitle')}</p>
          <ul className="grid gap-1">
            {errors.map((issue) => (
              <li key={issue.code} className="flex items-start gap-2 text-destructive">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{text(issue)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t('metaRulesErrorsHelp')}</p>
        </div>
      )}
      {warnings.length > 0 && (
        <div role="note" className="rounded-md border border-amber-500/60 bg-amber-500/10 p-3">
          <p className="mb-1 font-medium">{t('metaRulesWarningsTitle')}</p>
          <ul className="grid gap-1">
            {warnings.map((issue) => (
              <li key={issue.code} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <span>{text(issue)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
