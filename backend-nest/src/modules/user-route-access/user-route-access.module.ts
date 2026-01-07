import { Module } from '@nestjs/common';
import { UserRouteAccessController } from './user-route-access.controller';
import { UserRouteAccessService } from './user-route-access.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [UserRouteAccessController],
  providers: [UserRouteAccessService],
  exports: [UserRouteAccessService],
})
export class UserRouteAccessModule {}
