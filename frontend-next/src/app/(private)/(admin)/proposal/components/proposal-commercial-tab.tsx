'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FormBuilder, type FormBuilderField } from '@/components/form/form-builder';
import { useTranslation } from '@/hooks/use-translation';
import { useUpdateProposalTerms } from '@/lib/actions/proposal/queries';
import type { Proposal, UpdateProposalTermsDto } from '@/lib/actions/proposal/types';

/** Linhas não vazias, uma por linha — forma mais simples de editar uma lista curta sem componente novo. */
function parseLines(value?: string): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const RECURRENCE_VALUES = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

/** Aba `comercial`: formulário do envelope. A conversão reais ↔ centavos acontece só aqui, na
 * borda — nenhuma outra camada divide ou multiplica por 100. Salva por `PUT proposal/:id/terms`,
 * que o backend recusa fora de DRAFT (mesma regra do layout). */
export function ProposalCommercialTab({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation('proposal');
  const updateTerms = useUpdateProposalTerms();
  const isDraft = proposal.status === 'DRAFT';

  const schema = useMemo(
    () =>
      z.object({
        totalReais: z.string().optional(),
        currency: z.string().length(3, t('currencyLength')),
        recurrence: z.enum(RECURRENCE_VALUES),
        termDays: z.string().optional(),
        validUntil: z.string().optional(),
        includedItems: z.string().optional(),
        optionalItems: z.string().optional(),
      }),
    [t],
  );

  const fields = useMemo<FormBuilderField[]>(
    () => [
      {
        name: 'totalReais',
        label: t('totalReais'),
        placeholder: t('totalReaisPlaceholder'),
        disabled: !isDraft,
      },
      { name: 'currency', label: t('currency'), disabled: !isDraft },
      {
        name: 'recurrence',
        label: t('recurrence'),
        type: 'select',
        disabled: !isDraft,
        options: RECURRENCE_VALUES.map((value) => ({ value, label: t(`recurrenceOptions.${value}`) })),
      },
      { name: 'termDays', label: t('termDays'), placeholder: t('termDaysPlaceholder'), disabled: !isDraft },
      { name: 'validUntil', label: t('validUntil'), type: 'date', disabled: !isDraft },
      {
        name: 'includedItems',
        label: t('includedItems'),
        type: 'textarea',
        description: t('itemsHint'),
        disabled: !isDraft,
      },
      {
        name: 'optionalItems',
        label: t('optionalItems'),
        type: 'textarea',
        description: t('itemsHint'),
        disabled: !isDraft,
      },
    ],
    [t, isDraft],
  );

  return (
    <div className="space-y-4">
      {!isDraft && (
        <Alert>
          <AlertTitle>{t('commercialLockedTitle')}</AlertTitle>
          <AlertDescription>{t('commercialLockedDescription')}</AlertDescription>
        </Alert>
      )}
      {proposal.totalCents == null && (
        <Alert>
          <AlertTitle>{t('envelopeEmptyTitle')}</AlertTitle>
          <AlertDescription>{t('envelopeEmptyDescription')}</AlertDescription>
        </Alert>
      )}
      <FormBuilder
        key={proposal.id}
        schema={schema}
        fields={fields}
        mode="edit"
        gridClassName="grid gap-4 sm:grid-cols-2"
        values={{
          totalReais: proposal.totalCents != null ? (proposal.totalCents / 100).toFixed(2) : '',
          currency: proposal.currency,
          recurrence: proposal.recurrence,
          termDays: proposal.termDays != null ? String(proposal.termDays) : '',
          validUntil: proposal.validUntil ? proposal.validUntil.slice(0, 10) : '',
          includedItems: proposal.includedItems.join('\n'),
          optionalItems: proposal.optionalItems.join('\n'),
        }}
        onSubmit={async (data) => {
          const totalReais = data.totalReais?.trim().replace(',', '.');
          const termDays = data.termDays?.trim();
          const payload: UpdateProposalTermsDto = {
            totalCents: totalReais ? Math.round(Number(totalReais) * 100) : null,
            currency: data.currency,
            recurrence: data.recurrence,
            termDays: termDays ? Number(termDays) : null,
            validUntil: data.validUntil ? new Date(data.validUntil).toISOString() : null,
            includedItems: parseLines(data.includedItems),
            optionalItems: parseLines(data.optionalItems),
          };
          return updateTerms.mutateAsync({ id: proposal.id, data: payload });
        }}
        submitLabel={t('save')}
      />
    </div>
  );
}
