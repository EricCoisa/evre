import { Injectable, OnModuleInit } from '@nestjs/common';
import { RouteCeilingRegistry } from 'src/common/infrastructure/route-ceiling/route-ceiling.registry';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { RoutePathConst } from 'src/domain/route/route-path.const';

@Injectable()
export class MessagingRouteCeiling implements OnModuleInit {
  constructor(private readonly routeCeilings: RouteCeilingRegistry) {}

  onModuleInit(): void {
    this.routeCeilings.register(RoutePathConst.COMMUNICATION, [
      UserRoleConst.ADMIN,
    ]);
    this.routeCeilings.register(RoutePathConst.COMMUNICATION_TEMPLATES, [
      UserRoleConst.ADMIN,
    ]);
  }
}
