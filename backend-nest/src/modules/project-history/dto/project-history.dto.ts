import { ApiProperty } from '@nestjs/swagger';
import { ProjectHistory } from 'src/domain/project/projectHistory.entity';

export class ProjectHistoryDto {
  constructor(history?: ProjectHistory) {
    if (!history) return;
    this.id = history.id;
    this.projectId = history.projectId;
    this.type = history.type;
    this.payload = history.payload;
    this.createdAt = history.createdAt;
  }

  @ApiProperty({
    description: 'Unique identifier of the history entry',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Project identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  projectId: string;

  @ApiProperty({
    description: 'History type',
    example: 'STATUS_CHANGE',
  })
  type: string;

  @ApiProperty({
    description: 'History payload (JSON)',
    example: '{"oldStatus": "PROPOSAL", "newStatus": "REQUIREMENTS"}',
  })
  payload: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  createdAt: Date;
}
