import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FindSystemRolesUseCase } from './use-cases/find-system-roles.use-case';
import { CreateRoleUseCase } from './use-cases/create.use-case';
import { DeleteRoleUseCase } from './use-cases/delete.use-case';
import { ListSystemRolesTool } from './ai-tools/list-system-roles.tool';
import { CreateRoleTool } from './ai-tools/create-role.tool';
import { DeleteRoleTool } from './ai-tools/delete-role.tool';

@Module({
  imports: [PrismaModule],
  controllers: [RoleController],
  providers: [
    FindSystemRolesUseCase,
    CreateRoleUseCase,
    DeleteRoleUseCase,
    ListSystemRolesTool,
    CreateRoleTool,
    DeleteRoleTool,
  ],
})
export class RoleModule {}
