import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ClientLogService } from './client-log.service';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';

@Module({
  imports: [PrismaModule, forwardRef(() => SystemConfigurationModule)],
  providers: [ClientLogService],
  exports: [ClientLogService],
})
export class ClientLogModule {}
