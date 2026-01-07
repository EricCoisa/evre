import { UserRole } from '@prisma/client';

import { ApiProperty } from '@nestjs/swagger';
import { Route } from '../route/route.entity';

export class RoleRouteAccess {
  @ApiProperty({ enum: UserRole })
  roleId: UserRole;

  @ApiProperty()
  routeId: string;

  @ApiProperty({ type: () => Route })
  route?: Route;
}
