import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiParam, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type { Response } from 'express';
import type { Artifact } from '@prisma/client';
import {
  DeleteApi,
  GetApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import { JwtOrApiKeyAuthGuard } from '../../common/guards/jwt-or-api-key.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import {
  type PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { ARTIFACT_UPLOAD_HARD_LIMIT_BYTES } from 'src/domain/artifact/artifact.const';
import { ArtifactDto } from './dto/artifact.dto';
import { UploadArtifactUseCase } from './use-cases/upload-artifact.use-case';
import { ListArtifactsUseCase } from './use-cases/list-artifacts.use-case';
import { ArchiveArtifactUseCase } from './use-cases/archive-artifact.use-case';
import { DeleteArtifactUseCase } from './use-cases/delete-artifact.use-case';
import { ViewArtifactUseCase } from './use-cases/view-artifact.use-case';
import { PublishArtifactUseCase } from './use-cases/publish-artifact.use-case';
import { normalizeWildcardPath } from './wildcard-path.util';

import { RouteAccess } from 'src/common/decorators/route-access.decorator';
import { RoutePathConst } from 'src/domain/route/route-path.const';

const ARTIFACT_ROLES = [UserRoleConst.ADMIN, UserRoleConst.MODERATOR];
const ARTIFACT_DELETE_ROLES = [UserRoleConst.ADMIN];

/** Gestão de artefatos (arquivo ou pasta de arquivos), agnóstico de quem consome — hoje: bloco
 * `iframe` do page-builder. Ver docs/architecture/data-model.md. */
@ApiTags('artifact')
@Controller('artifacts')
@RouteAccess(RoutePathConst.ARTIFACT)
export class ArtifactController {
  constructor(
    private readonly uploadArtifact: UploadArtifactUseCase,
    private readonly listArtifacts: ListArtifactsUseCase,
    private readonly archiveArtifact: ArchiveArtifactUseCase,
    private readonly deleteArtifact: DeleteArtifactUseCase,
    private readonly viewArtifact: ViewArtifactUseCase,
    private readonly publishArtifact: PublishArtifactUseCase,
  ) {}

  @GetApi({
    summary: 'artifact.list.title',
    status: 'OK',
    roles: ARTIFACT_ROLES,
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Lista paginada de artefatos',
          schema: { dto: ArtifactDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async list(
    @Query(new ZodValidationPipe(PaginationQuerySchema))
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Artifact> | Artifact[]> {
    return this.listArtifacts.execute(query);
  }

  @PostApi({
    summary: 'artifact.upload.title',
    status: 'CREATED',
    roles: ARTIFACT_ROLES,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Artefato enviado',
          schema: { dto: ArtifactDto },
        },
      ],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ARTIFACT_UPLOAD_HARD_LIMIT_BYTES },
    }),
  )
  async upload(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body('name') name?: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<Artifact> {
    return this.uploadArtifact.execute(
      file,
      currentUser,
      name?.trim() || undefined,
    );
  }

  @DeleteApi({
    path: ':id',
    summary: 'artifact.delete.title',
    status: 'OK',
    roles: ARTIFACT_ROLES,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Artefato arquivado',
          schema: { dto: ArtifactDto },
        },
      ],
    },
  })
  async archive(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<Artifact> {
    return this.archiveArtifact.execute(id, currentUser);
  }

  @DeleteApi({
    path: ':id/permanent',
    summary: 'artifact.deletePermanent.title',
    status: 'OK',
    roles: ARTIFACT_DELETE_ROLES,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Artefato excluído permanentemente',
          schema: { dto: ArtifactDto },
        },
      ],
    },
  })
  async deletePermanently(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<Artifact> {
    return this.deleteArtifact.execute(id, currentUser);
  }

  @PostApi({
    path: ':id/publish',
    summary: 'artifact.publish.title',
    status: 'OK',
    roles: ARTIFACT_ROLES,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Artefato publicado',
          schema: { dto: ArtifactDto },
        },
      ],
    },
  })
  async publish(
    @Param('id') id: string,
    @Body('public') isPublic?: boolean,
  ): Promise<Artifact> {
    return this.publishArtifact.execute(id, isPublic ?? false);
  }

  @Get(':id/preview')
  @UseGuards(JwtOrApiKeyAuthGuard, ScopeGuard, RolesGuard)
  @Roles(...ARTIFACT_ROLES)
  @ApiBearerAuth()
  @ApiExcludeEndpoint()
  async preview(@Param('id') id: string): Promise<{ url: string }> {
    const url = await this.viewArtifact.execute(id, undefined);
    return { url };
  }

  // Redirect puro (302): GetApi só aceita um `path`, e esta rota precisa de dois patterns pro
  // mesmo handler (com e sem sub-caminho de pasta) — o guard stack é o mesmo que `roles:
  // ARTIFACT_ROLES` montaria via GetApi, replicado manualmente. Ver docs/backend/storage.md.
  @Get([':id/view', ':id/view/*path'])
  @UseGuards(JwtOrApiKeyAuthGuard, ScopeGuard, RolesGuard)
  @Roles(...ARTIFACT_ROLES)
  @ApiBearerAuth()
  @ApiParam({ name: 'path', required: true, schema: { type: 'string' }, description: 'Sub-path inside a folder artifact' })
  async view(
    @Param('id') id: string,
    @Param('path') path: string | string[] | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.viewArtifact.execute(
      id,
      normalizeWildcardPath(path),
    );
    res.redirect(HttpStatus.FOUND, url);
  }
}
