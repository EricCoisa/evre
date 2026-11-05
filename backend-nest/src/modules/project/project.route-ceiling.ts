import { Injectable, OnModuleInit } from '@nestjs/common';
import { RouteCeilingRegistry } from 'src/common/infrastructure/route-ceiling/route-ceiling.registry';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { RoutePathConst } from 'src/domain/route/route-path.const';

@Injectable()
export class ProjectRouteCeiling implements OnModuleInit {
  constructor(private readonly routeCeilings: RouteCeilingRegistry) {}

  onModuleInit(): void {
    this.routeCeilings.register(RoutePathConst.PROJECT, [
      UserRoleConst.ADMIN,
      UserRoleConst.MODERATOR,
    ]);
    this.routeCeilings.register(RoutePathConst.MY_PROJECT, [
      UserRoleConst.ADMIN,
      UserRoleConst.USER,
    ]);
  }
}
