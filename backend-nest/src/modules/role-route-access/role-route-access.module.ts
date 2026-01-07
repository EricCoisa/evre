import { Module } from '@nestjs/common';
import { RoleRouteAccessController } from './role-route-access.controller';
import { RoleRouteAccessService } from './role-route-access.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [RoleRouteAccessController],
  providers: [RoleRouteAccessService],
  exports: [RoleRouteAccessService],
})
export class RoleRouteAccessModule {}
