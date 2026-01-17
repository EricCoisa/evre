import { ApiProperty } from '@nestjs/swagger';
import { Comment } from 'src/domain/project/comment.entity';

export class CommentDto {
  constructor(comment?: Comment & { user?: { name: string | null; email: string } }) {
    if (!comment) return;
    this.id = comment.id;
    this.projectId = comment.projectId;
    this.entityType = comment.entityType;
    this.entityId = comment.entityId;
    this.userId = comment.userId;
    this.content = comment.content;
    this.createdAt = comment.createdAt;
    this.userName = comment.user?.name ?? undefined;
    this.userEmail = comment.user?.email;
  }

  @ApiProperty({
    description: 'Unique identifier of the comment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Project identifier (context root)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  projectId: string;

  @ApiProperty({
    description: 'Entity type (PROJECT, STAGE, or ACTIVITY)',
    example: 'PROJECT',
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
    description: 'Comment content',
    example: 'The design looks great! Let\'s proceed with implementation.',
  })
  content: string;

  @ApiProperty({
    description: 'User name (optional)',
    example: 'John Doe',
    required: false,
  })
  userName?: string;

  @ApiProperty({
    description: 'User email (optional)',
    example: 'john@example.com',
    required: false,
  })
  userEmail?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-07T10:00:00.000Z',
  })
  createdAt: Date;
}
