import { ApiProperty } from '@nestjs/swagger';
import { Activity } from 'src/domain/project/activity.entity';

export class ActivityDto {
  constructor(activity?: Activity) {
    if (!activity) return;
    this.id = activity.id;
    this.stageId = activity.stageId;
    this.title = activity.title;
    this.description = activity.description;
    this.status = activity.status;
    this.createdAt = activity.createdAt;
    this.updatedAt = activity.updatedAt;
  }

  @ApiProperty({
    description: 'Unique identifier of the activity',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Stage identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  stageId: string;

  @ApiProperty({
    description: 'Activity title',
    example: 'Create database schema',
  })
  title: string;

  @ApiProperty({
    description: 'Activity description',
    example: 'Design and implement the database schema for the application',
    required: false,
  })
  description: string | null;

  @ApiProperty({
    description: 'Activity status',
    example: 'TODO',
  })
  status: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  updatedAt: Date;
}
