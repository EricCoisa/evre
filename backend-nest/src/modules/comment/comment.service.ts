import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentDto } from './dto/comment.dto';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { CommentEntityType } from '@prisma/client';

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
    user?: { role: string; companyId?: string | null },
  ): Promise<CommentDto> {
    // Valida se o projeto existe
    const project = await this.prisma.project.findUnique({
      where: { id: createCommentDto.projectId },
    });
    if (!project)
      throw new NotFoundException(
        this.i18n.t('comment.errors.project_not_found') || 'Project not found',
      );

    // 🔒 SECURITY: USER só pode criar comentários em projetos da própria empresa
    if (user && user.role === 'USER' && user.companyId) {
      if (project.companyId !== user.companyId) {
        throw new NotFoundException(
          this.i18n.t('comment.errors.project_not_found') ||
            'Project not found',
        );
      }
    }

    // Valida se a entidade existe baseado no tipo
    if (createCommentDto.entityType === 'PROJECT') {
      if (createCommentDto.entityId !== createCommentDto.projectId) {
        throw new NotFoundException(
          this.i18n.t('comment.errors.project_mismatch') || 'Project mismatch',
        );
      }
    } else if (createCommentDto.entityType === 'STAGE') {
      const stage = await this.prisma.stage.findUnique({
        where: { id: createCommentDto.entityId },
      });
      if (!stage)
        throw new NotFoundException(
          this.i18n.t('comment.errors.stage_not_found') || 'Stage not found',
        );
    } else if (createCommentDto.entityType === 'ACTIVITY') {
      const activity = await this.prisma.activity.findUnique({
        where: { id: createCommentDto.entityId },
      });
      if (!activity)
        throw new NotFoundException(
          this.i18n.t('comment.errors.activity_not_found') ||
            'Activity not found',
        );
    }

    const comment = await this.prisma.comment.create({
      data: {
        projectId: createCommentDto.projectId,
        entityType: createCommentDto.entityType,
        entityId: createCommentDto.entityId,
        userId,
        content: createCommentDto.content,
      },
    });

    // Registra histórico apenas se for comentário em projeto
    if (createCommentDto.entityType === 'PROJECT') {
      await this.prisma.projectHistory.create({
        data: {
          projectId: createCommentDto.projectId,
          type: 'COMMENT',
          payload: JSON.stringify({
            commentId: comment.id,
            userId,
            content: comment.content,
          }),
        },
      });
    }

    await this.loggingService.create(
      {
        module: 'COMMENT',
        action: LogActions.CREATE,
        message: `Comment created on ${createCommentDto.entityType}`,
        metadata: {
          commentId: comment.id,
          projectId: createCommentDto.projectId,
          entityType: createCommentDto.entityType,
          entityId: createCommentDto.entityId,
        },
      },
      userId,
    );

    return new CommentDto(comment);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    user?: { role: string; companyId?: string | null },
  ): Promise<CommentDto[]> {
    // 🔒 SECURITY: USER só pode acessar comentários de projetos da própria empresa
    // Busca o projectId através da entidade comentada
    let projectId: string | null = null;

    if (entityType === 'PROJECT') {
      projectId = entityId;
    } else if (entityType === 'STAGE') {
      const stage = await this.prisma.stage.findUnique({
        where: { id: entityId },
        select: { projectId: true },
      });
      projectId = stage?.projectId || null;
    } else if (entityType === 'ACTIVITY') {
      const activity = await this.prisma.activity.findUnique({
        where: { id: entityId },
        include: { stage: { select: { projectId: true } } },
      });
      projectId = activity?.stage?.projectId || null;
    }

    // Valida acesso do USER à empresa do projeto
    if (user && user.role === 'USER' && user.companyId && projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { companyId: true },
      });
      if (!project || project.companyId !== user.companyId) {
        throw new NotFoundException('Entity not found');
      }
    }
    const comments = await this.prisma.comment.findMany({
      where: {
        entityType: entityType as CommentEntityType,
        entityId,
      },
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
