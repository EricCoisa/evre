import { Controller, Body, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  GetApi,
  PostApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { FindSystemRolesUseCase } from './use-cases/find-system-roles.use-case';
import { CreateRoleUseCase } from './use-cases/create.use-case';
import { DeleteRoleUseCase } from './use-cases/delete.use-case';

@ApiTags('role')
@Controller('role')
export class RoleController {
  constructor(
    private readonly findSystemRoles: FindSystemRolesUseCase,
    private readonly createRole: CreateRoleUseCase,
    private readonly deleteRole: DeleteRoleUseCase,
  ) {}

  @GetApi({
    path: 'system',
    summary: 'List system roles',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  findSystemRolesHandler() {
    return this.findSystemRoles.execute();
  }

  @PostApi({
    summary: 'Create global role',
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  create(@Body() body: { name: string }) {
    return this.createRole.execute(body.name);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Delete role (blocks system roles)',
    status: 'NO_CONTENT',
    authenticated: true,
    roles: ['ADMIN'],
  })
  delete(@Param('id') id: string) {
    return this.deleteRole.execute(id);
  }
}
