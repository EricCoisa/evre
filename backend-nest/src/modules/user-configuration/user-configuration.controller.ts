import { Controller, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  GetApi,
  PostApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { SetUserConfigurationDto } from './dto/set-user-configuration.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { UserConfigurationDto } from './dto/user-configuration.dto';
import { GetUserConfigurationsUseCase } from './use-cases/get-user-configurations.use-case';
import { GetUserConfigurationByKeyUseCase } from './use-cases/get-by-key.use-case';
import { SetUserConfigurationUseCase } from './use-cases/set-user-configuration.use-case';
import { ResetUserConfigurationUseCase } from './use-cases/reset-user-configuration.use-case';
import { ResetAllUserConfigurationsUseCase } from './use-cases/reset-all.use-case';

@ApiTags('user-configuration')
@Controller('user-configuration')
export class UserConfigurationController {
  constructor(
    private readonly getUserConfigurationsUseCase: GetUserConfigurationsUseCase,
    private readonly getUserConfigurationByKeyUseCase: GetUserConfigurationByKeyUseCase,
    private readonly setUserConfigurationUseCase: SetUserConfigurationUseCase,
    private readonly resetUserConfigurationUseCase: ResetUserConfigurationUseCase,
    private readonly resetAllUserConfigurationsUseCase: ResetAllUserConfigurationsUseCase,
  ) {}

  @GetApi({
    path: 'me',
    summary: 'Obtém configurações do usuário logado',
    description: `Retorna todas as configurações disponíveis com os valores do usuário ou valores padrão`,
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração encontrada',
          schema: {
            dto: UserConfigurationDto,
            isArray: true,
            isPagination: false,
          },
        },
      ],
    },
  })
  async getUserConfigurations(@CurrentUser() user: AuthenticatedUser) {
    return await this.getUserConfigurationsUseCase.execute(user.id);
  }

  @GetApi({
    path: 'key/:labelKey',
    summary: 'Obtém configurações do usuário logado',
    description: `Retorna todas as configurações disponíveis com os valores do usuário ou valores padrão`,
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração encontrada',
          schema: { dto: UserConfigurationDto },
        },
      ],
    },
  })
  async getUserConfigurationsKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('labelKey') labelKey: string,
  ) {
    return await this.getUserConfigurationByKeyUseCase.execute(
      user.id,
      labelKey,
      { roleName: user.roleName },
    );
  }

  @PostApi({
    path: 'me',
    summary: 'Define configuração do usuário',
    description: 'Define ou atualiza uma configuração para o usuário logado',
    status: 'OK',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Configuração definida com sucesso',
        },
      ],
    },
  })
  async setUserConfiguration(
    @Body() dto: SetUserConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.setUserConfigurationUseCase.execute(user.id, dto);
  }

  @DeleteApi({
    path: 'me/:definitionId',
    summary: 'Reseta configuração específica',
    description: 'Remove a customização e volta para o valor padrão',
    status: 'NO_CONTENT',
    authenticated: true,
    response: {
      success: [
        {
          status: 'NO_CONTENT',
          description: 'Configuração resetada com sucesso',
        },
      ],
    },
  })
  async resetUserConfiguration(
    @Param('definitionId') definitionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.resetUserConfigurationUseCase.execute(
      user.id,
      definitionId,
    );
  }

  @DeleteApi({
    path: 'me',
    summary: 'Reseta todas as configurações',
    description: 'Remove todas as customizações do usuário',
    status: 'NO_CONTENT',
    authenticated: true,
    response: {
      success: [
        {
          status: 'NO_CONTENT',
          description: 'Todas as configurações resetadas com sucesso',
        },
      ],
    },
  })
  async resetAllUserConfigurations(@CurrentUser() user: AuthenticatedUser) {
    return await this.resetAllUserConfigurationsUseCase.execute(user.id);
  }
}
