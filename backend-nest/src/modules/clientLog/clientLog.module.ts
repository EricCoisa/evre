import { Module } from '@nestjs/common';

import { ClientLogController } from './clientLog.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClientLogService } from './clientLog.service';

@Module({
  imports: [PrismaModule],
  providers: [ClientLogService],
  controllers: [ClientLogController],
  exports: [ClientLogService],
})
export class ClientLogModule {}
