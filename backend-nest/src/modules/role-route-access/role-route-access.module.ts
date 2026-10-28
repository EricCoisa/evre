import { Module } from '@nestjs/common';
import { RoleRouteAccessController } from './role-route-access.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { FindAllRoleRouteAccessUseCase } from './use-cases/find-all.use-case';
import { FindOneRoleRouteAccessUseCase } from './use-cases/find-one.use-case';
import { CreateRoleRouteAccessUseCase } from './use-cases/create.use-case';
import { RemoveRoleRouteAccessUseCase } from './use-cases/remove.use-case';
import { FindAllUserRoleUseCase } from './use-cases/find-all-user-role.use-case';
import { FindByRoleUseCase } from './use-cases/find-by-role.use-case';
import { RemoveByRoleUseCase } from './use-cases/remove-by-role.use-case';
import { GrantRoleRouteAccessTool } from './ai-tools/grant-role-route-access.tool';
import { ListRoleRouteAccessTool } from './ai-tools/list-role-route-access.tool';
import { ListRoleRouteAccessUserRolesTool } from './ai-tools/list-role-route-access-user-roles.tool';
import { ListRoleRouteAccessByRoleTool } from './ai-tools/list-role-route-access-by-role.tool';
import { GetRoleRouteAccessTool } from './ai-tools/get-role-route-access.tool';
import { RemoveRoleRouteAccessTool } from './ai-tools/remove-role-route-access.tool';
import { RemoveRoleRouteAccessByRoleTool } from './ai-tools/remove-role-route-access-by-role.tool';

@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [RoleRouteAccessController],
  providers: [
    FindAllRoleRouteAccessUseCase,
    FindOneRoleRouteAccessUseCase,
    CreateRoleRouteAccessUseCase,
    RemoveRoleRouteAccessUseCase,
    FindAllUserRoleUseCase,
    FindByRoleUseCase,
    RemoveByRoleUseCase,
    GrantRoleRouteAccessTool,
    ListRoleRouteAccessTool,
    ListRoleRouteAccessUserRolesTool,
    ListRoleRouteAccessByRoleTool,
    GetRoleRouteAccessTool,
    RemoveRoleRouteAccessTool,
    RemoveRoleRouteAccessByRoleTool,
  ],
  exports: [
    FindAllRoleRouteAccessUseCase,
    FindOneRoleRouteAccessUseCase,
    CreateRoleRouteAccessUseCase,
    RemoveRoleRouteAccessUseCase,
    FindAllUserRoleUseCase,
    FindByRoleUseCase,
    RemoveByRoleUseCase,
  ],
})
export class RoleRouteAccessModule {}
