import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils';
import { PublicProposalView } from './public-proposal-view';
import { formatDateOnly } from '@/lib/utils';
import type { PublicProposalDto } from '@/lib/generated/schemas';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function proposal(overrides: Partial<PublicProposalDto> = {}): PublicProposalDto {
  return {
    proposalName: 'Site novo',
    companyName: null,
    layout: { v: 1, blocks: [] },
    envelope: {
      totalCents: 150000,
      currency: 'BRL',
      recurrence: 'ONE_TIME',
      termDays: 30,
      validUntil: '2026-11-15T00:00:00.000Z',
      includedItems: [],
      optionalItems: [],
    },
    acceptedAt: null,
    ...overrides,
  };
}

describe('PublicProposalView — validUntil no header e no modal de aceite', () => {
  it('usa o mesmo formato (sem hora) nos dois lugares', async () => {
    const user = userEvent.setup();
    const data = proposal();
    const expected = formatDateOnly(data.envelope.validUntil as string);

    const { container } = render(<PublicProposalView token="tok" proposal={data} />);
    expect(container.textContent).toContain(expected);

    await user.type(screen.getByLabelText('acceptName'), 'Fulano');
    await user.type(screen.getByLabelText('acceptEmail'), 'fulano@example.com');
    await user.click(screen.getByRole('button', { name: 'acceptButton' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(expected)).toBeInTheDocument();
    // formatDate (com hora) nunca deve aparecer — é a regressão que esta etapa corrigiu.
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
