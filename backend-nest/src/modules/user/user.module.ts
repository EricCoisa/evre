import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { UserRouteAccessModule } from '../user-route-access/user-route-access.module';
import { forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';

@Module({
  imports: [
    PrismaModule,
    UserRouteAccessModule,
    SystemConfigurationModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
