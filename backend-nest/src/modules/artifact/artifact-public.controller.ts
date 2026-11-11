import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ViewPublicArtifactUseCase } from './use-cases/view-public-artifact.use-case';
import { normalizeWildcardPath } from './wildcard-path.util';

/** Única rota deste módulo sem auth — resolve por `publicToken`, nunca por id interno, e só
 * libera o artefato se `published`. Ver docs/backend/storage.md. */
@ApiTags('artifact-public')
@Controller('artifacts/public')
export class ArtifactPublicController {
  constructor(private readonly viewPublicArtifact: ViewPublicArtifactUseCase) {}

  @Get([':token', ':token/*path'])
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiParam({
    name: 'path',
    required: true,
    schema: { type: 'string' },
    description: 'Sub-path inside a folder artifact',
  })
  async view(
    @Param('token') token: string,
    @Param('path') path: string | string[] | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.viewPublicArtifact.execute(
      token,
      normalizeWildcardPath(path),
    );
    res.redirect(HttpStatus.FOUND, url);
  }
}
