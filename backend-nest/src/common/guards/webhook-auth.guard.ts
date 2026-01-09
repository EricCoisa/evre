import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    interface TypedRequest {
      headers: Record<string, string>;
      project?: { id: string; token: string; companyId: string };
    }
    const request = context.switchToHttp().getRequest<TypedRequest>();
    const projectId = request.headers['x-project-id'];
    const token = request.headers['authorization']?.replace('Bearer ', '');

    if (!projectId || !token) {
      throw new UnauthorizedException(
        'Missing project ID or authorization token',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, token: true, companyId: true },
    });

    if (!project || !project.token) {
      throw new UnauthorizedException('Invalid project ID');
    }

    if (project.token !== token) {
      throw new UnauthorizedException('Invalid authorization token');
    }

    // Adiciona os dados do projeto no request para uso posterior
    request.project = {
      id: project.id,
      token: project.token ?? '',
      companyId: project.companyId,
    };

    return true;
  }
}
