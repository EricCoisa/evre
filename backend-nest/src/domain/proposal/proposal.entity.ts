import { ApiProperty } from '@nestjs/swagger';
import type { ProposalStatusValue } from './proposalStatus.const';
import type { ProposalRecurrenceValue } from './proposalRecurrence.const';

export class Proposal {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false, nullable: true })
  companyId?: string | null;

  @ApiProperty()
  ownerId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['DRAFT', 'SENT', 'ACCEPTED', 'LOST'] })
  status: ProposalStatusValue;

  @ApiProperty({ required: false, nullable: true })
  lostReason?: string | null;

  @ApiProperty({ required: false, nullable: true, type: Object })
  layout?: Record<string, unknown> | null;

  @ApiProperty({ required: false, nullable: true, description: 'Centavos' })
  totalCents?: number | null;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY'] })
  recurrence: ProposalRecurrenceValue;

  @ApiProperty({ required: false, nullable: true })
  termDays?: number | null;

  @ApiProperty({ required: false, nullable: true })
  validUntil?: Date | null;

  @ApiProperty({ type: [String] })
  includedItems: string[];

  @ApiProperty({ type: [String] })
  optionalItems: string[];

  @ApiProperty({ required: false, nullable: true })
  archivedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
