import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetApi } from '../../common/decorators/api-method.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @GetApi({ summary: 'common.health.title' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
