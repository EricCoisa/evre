import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatusConst } from './approvalStatus.const';

export class Approval {
  @ApiProperty({
    description: 'Unique identifier of the approval',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Stage identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  stageId: string;

  @ApiProperty({
    description: 'User identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Approval status',
    enum: Object.values(ApprovalStatusConst),
    example: ApprovalStatusConst.APPROVED,
  })
  status: string;

  @ApiProperty({
    description: 'Approval comment',
    example: 'All deliverables were met successfully',
    required: false,
  })
  comment: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  createdAt: Date;
}
