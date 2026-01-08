import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentDto } from './dto/comment.dto';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async create(
    createCommentDto: CreateCommentDto,
    userId: string,
  ): Promise<CommentDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: createCommentDto.projectId },
    });
    if (!project)
      throw new NotFoundException(
        this.i18n.t('comment.errors.project_not_found') || 'Project not found',
      );

    const comment = await this.prisma.comment.create({
      data: {
        projectId: createCommentDto.projectId,
        userId,
        content: createCommentDto.content,
      },
    });

    // Registra histórico
    await this.prisma.projectHistory.create({
      data: {
        projectId: comment.projectId,
        type: 'COMMENT',
        payload: JSON.stringify({
          commentId: comment.id,
          userId,
          content: comment.content,
        }),
      },
    });

    await this.loggingService.create(
      {
        module: 'COMMENT',
        action: LogActions.CREATE,
        message: 'Comment created',
        metadata: { commentId: comment.id },
      },
      userId,
    );

    return new CommentDto(comment);
  }

  async findByProject(projectId: string): Promise<CommentDto[]> {
    const comments = await this.prisma.comment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return comments.map((c) => new CommentDto(c));
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment)
      throw new NotFoundException(
        this.i18n.t('comment.errors.not_found') || 'Comment not found',
      );

    await this.prisma.comment.delete({ where: { id } });
    await this.loggingService.create(
      {
        module: 'COMMENT',
        action: LogActions.DELETE,
        message: 'Comment deleted',
        metadata: { commentId: id },
      },
      userId,
    );
  }
}
