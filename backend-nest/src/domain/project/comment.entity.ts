import { ApiProperty } from '@nestjs/swagger';

export class Comment {
  @ApiProperty({
    description: 'Unique identifier of the comment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Project identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  projectId: string;

  @ApiProperty({
    description: 'User identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Comment content',
    example: "The design looks great! Let's proceed with implementation.",
  })
  content: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  createdAt: Date;
}
