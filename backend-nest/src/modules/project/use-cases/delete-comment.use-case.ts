import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class DeleteCommentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(projectId: string, commentId: string, user: AuthenticatedUser) {
    const comment = await this.prisma.projectComment.findFirst({
      where: { id: commentId, projectId },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('project.comment_not_found'));
    }
    if (comment.authorId !== user.id && user.roleName !== 'ADMIN') {
      throw new ForbiddenException();
    }
    await this.prisma.projectComment.delete({ where: { id: commentId } });
  }
}
