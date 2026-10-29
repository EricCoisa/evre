import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProposalSendChannelConst } from 'src/domain/proposal/proposalSendChannel.const';

export const ProposalSendSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
  channel: z.enum(
    Object.values(ProposalSendChannelConst) as [string, ...string[]],
  ),
  toPhone: z.string().optional().nullable(),
  toEmail: z.string().optional().nullable(),
  succeeded: z.boolean(),
  detail: z.string().optional().nullable(),
  sentById: z.string().uuid().optional().nullable(),
  createdAt: z.string().datetime(),
});

export class ProposalSendDto extends createZodDto(ProposalSendSchema) {}
