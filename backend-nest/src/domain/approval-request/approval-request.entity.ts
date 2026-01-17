import { ApiProperty } from '@nestjs/swagger';
import { ApprovalRequestStatus } from './approval-requestStatus.const';

export class ApprovalRequest {
  @ApiProperty({
    description: 'Unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  projectId: string;

  @ApiProperty({
    description: 'Stage ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  stageId: string;

  @ApiProperty({
    description: 'ID of the admin who requested the approval',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  requestedById: string;

  @ApiProperty({
    description: 'Approval request status',
    enum: ApprovalRequestStatus,
    example: ApprovalRequestStatus.PENDING,
  })
  status: ApprovalRequestStatus;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-01-16T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-01-16T10:00:00.000Z',
  })
  updatedAt: Date;
}
