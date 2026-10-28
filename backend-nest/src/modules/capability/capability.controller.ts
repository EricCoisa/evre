import { Controller } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { GetApi } from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { CapabilityRegistry } from './capability.registry';
import { CapabilityStatusDto } from './dto/capability-status.dto';
import type { CapabilityStatus } from 'src/domain/capability/capability.types';

@ApiTags('capabilities')
@Controller('capabilities')
export class CapabilityController {
  constructor(private readonly registry: CapabilityRegistry) {}

  // Sem `roles` (D9): qualquer usuário autenticado resolve suas próprias capabilities.
  @GetApi({
    summary:
      'Resolve o estado de todas as capabilities para o usuário autenticado',
    status: 'OK',
    authenticated: true,
  })
  @ApiExtraModels(CapabilityStatusDto)
  @ApiResponse({
    status: 200,
    description: 'Mapa nome da capability -> estado',
    schema: {
      type: 'object',
      additionalProperties: { $ref: getSchemaPath(CapabilityStatusDto) },
    },
  })
  async getAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Record<string, CapabilityStatus>> {
    const result = await this.registry.resolveAll(user.roleName);
    if (user.roleName !== 'ADMIN') {
      for (const status of Object.values(result)) {
        delete status.reason;
      }
    }
    return result;
  }
}
