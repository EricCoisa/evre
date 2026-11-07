import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetApi } from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { CmsService } from './cms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RouteAccess } from 'src/common/decorators/route-access.decorator';
import { RoutePathConst } from 'src/domain/route/route-path.const';

@ApiTags('cms')
@Controller('cms')
@RouteAccess(RoutePathConst.CMS)
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @GetApi({
    path: 'credentials',
    summary: 'Obter credenciais do Payload CMS',
    description:
      'Verifica acesso à rota /cms, garante PayloadUser existente e retorna credenciais para login no Payload',
    status: 'OK',
    authenticated: true,
  })
  @UseGuards(JwtAuthGuard)
  async getCredentials(@CurrentUser() currentUser: AuthenticatedUser) {
    const credentials = await this.cmsService.getCredentials(
      currentUser.id,
      currentUser.roleId,
    );
    return { email: credentials.email, password: credentials.password };
  }
}
