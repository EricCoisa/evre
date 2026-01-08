import { Controller, Body, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentDto } from './dto/comment.dto';
import {
  PostApi,
  GetApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';

@ApiTags('comment')
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @PostApi({
    path: '',
    summary: 'Create a new comment',
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Comment created successfully',
          schema: { dto: CommentDto },
        },
      ],
    },
    authenticated: true,
    status: 'CREATED',
  })
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentDto> {
    return this.commentService.create(createCommentDto, user.id);
  }

  @GetApi({
    path: ':entityType/:entityId',
    summary: 'Get comments by entity',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Comments retrieved successfully',
          schema: { dto: CommentDto, isArray: true },
        },
      ],
    },
    authenticated: true,
  })
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<CommentDto[]> {
    return this.commentService.findByEntity(entityType, entityId);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Delete a comment',
    response: {
      success: [
        { status: 'NO_CONTENT', description: 'Comment deleted successfully' },
      ],
    },
    authenticated: true,
    status: 'NO_CONTENT',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.commentService.remove(id, user.id);
  }
}
