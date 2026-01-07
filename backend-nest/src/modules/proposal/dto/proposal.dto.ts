import { ApiProperty } from '@nestjs/swagger';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';
import { Proposal } from 'src/domain/proposal/proposal.entity';

export class ProposalDto {
  constructor(proposal?: Proposal) {
    if (!proposal) return;
    Object.assign(this, {
      id: proposal.id,
      companyId: proposal.companyId,
      status: proposal.status,
      contentSchemaVersion: proposal.contentSchemaVersion,
      content: proposal.content,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    });
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty({ enum: ProposalStatusConst })
  status: string;

  @ApiProperty()
  contentSchemaVersion: string;

  @ApiProperty({ description: 'JSON content stored as string' })
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
