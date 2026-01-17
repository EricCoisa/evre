import { ApiProperty } from '@nestjs/swagger';
import { Approval } from 'src/domain/project/approval.entity';

export class ApprovalDto {
  constructor(approval?: Approval) {
    if (!approval) return;
    this.id = approval.id;
    this.approvalRequestId = approval.approvalRequestId;
    this.projectId = approval.projectId;
    this.entityType = approval.entityType;
    this.entityId = approval.entityId;
    this.userId = approval.userId;
    this.status = approval.status;
    this.comment = approval.comment;
    this.createdAt = approval.createdAt;
  }

  @ApiProperty({
    description: 'Unique identifier of the approval',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Approval request identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  approvalRequestId: string;

  @ApiProperty({
    description: 'Project identifier (context root)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  projectId: string;

  @ApiProperty({
    description: 'Entity type (STAGE)',
    example: 'STAGE',
  })
  entityType: string;

  @ApiProperty({
    description: 'Entity identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  entityId: string;

  @ApiProperty({
    description: 'User identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Approval status',
    example: 'APPROVED',
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
