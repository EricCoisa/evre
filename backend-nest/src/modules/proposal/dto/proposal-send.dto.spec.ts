import { ProposalSendSchema } from './proposal-send.dto';

const base = {
  id: '11111111-1111-1111-1111-111111111111',
  versionId: '00000000-0000-0000-0000-000000000000',
  toPhone: null,
  toEmail: null,
  succeeded: true,
  detail: null,
  sentById: null,
  createdAt: new Date().toISOString(),
};

describe('ProposalSendSchema.channel', () => {
  it.each(['WHATSAPP', 'EMAIL', 'MANUAL'])('aceita %s', (channel) => {
    const result = ProposalSendSchema.safeParse({ ...base, channel });

    expect(result.success).toBe(true);
  });

  it('recusa um valor fora do conjunto fechado', () => {
    const result = ProposalSendSchema.safeParse({ ...base, channel: 'SMS' });

    expect(result.success).toBe(false);
  });
});
