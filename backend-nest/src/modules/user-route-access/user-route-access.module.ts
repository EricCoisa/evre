import { Global, Module } from '@nestjs/common';
import { UserRouteAccessController } from './user-route-access.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { FindAllUserRouteAccessUseCase } from './use-cases/find-all.use-case';
import { FindAllByOneUseCase } from './use-cases/find-all-by-one.use-case';
import { GrantAccessUseCase } from './use-cases/grant-access.use-case';
import { RevokeAccessUseCase } from './use-cases/revoke-access.use-case';
import { RevokeAllAccessUseCase } from './use-cases/revoke-all-access.use-case';
import { FindAllRoutesWithUserAccessUseCase } from './use-cases/find-all-routes-with-user-access.use-case';
import { CheckAccessUseCase } from './use-cases/check-access.use-case';
import { GrantUserRouteAccessTool } from './ai-tools/grant-user-route-access.tool';
import { ListUserRouteAccessTool } from './ai-tools/list-user-route-access.tool';
import { ListUserRouteAccessByUserTool } from './ai-tools/list-user-route-access-by-user.tool';
import { CheckMyRouteAccessTool } from './ai-tools/check-my-route-access.tool';
import { RevokeUserRouteAccessTool } from './ai-tools/revoke-user-route-access.tool';
import { RevokeAllUserRouteAccessTool } from './ai-tools/revoke-all-user-route-access.tool';

@Global()
@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [UserRouteAccessController],
  providers: [
    FindAllUserRouteAccessUseCase,
    FindAllByOneUseCase,
    GrantAccessUseCase,
    RevokeAccessUseCase,
    RevokeAllAccessUseCase,
    FindAllRoutesWithUserAccessUseCase,
    CheckAccessUseCase,
    GrantUserRouteAccessTool,
    ListUserRouteAccessTool,
    ListUserRouteAccessByUserTool,
    CheckMyRouteAccessTool,
    RevokeUserRouteAccessTool,
    RevokeAllUserRouteAccessTool,
  ],
  exports: [
    CheckAccessUseCase,
    FindAllByOneUseCase,
    FindAllRoutesWithUserAccessUseCase,
  ],
})
export class UserRouteAccessModule {}
