import { ApiProperty } from '@nestjs/swagger';
import { Stage } from 'src/domain/project/stage.entity';

export class StageDto {
  constructor(stage?: Stage) {
    if (!stage) return;
    this.id = stage.id;
    this.projectId = stage.projectId;
    this.name = stage.name;
    this.order = stage.order;
    this.status = stage.status;
    this.createdAt = stage.createdAt;
    this.updatedAt = stage.updatedAt;
  }

  @ApiProperty({
    description: 'Unique identifier of the stage',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Project identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  projectId: string;

  @ApiProperty({
    description: 'Stage name',
    example: 'Planning',
  })
  name: string;

  @ApiProperty({
    description: 'Stage order',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description: 'Stage status (informativo)',
    example: 'IN_PROGRESS',
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
