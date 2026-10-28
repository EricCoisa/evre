import { ApiProperty } from '@nestjs/swagger';
import { Route } from '../route/route.entity';

export class RoleRouteAccess {
  @ApiProperty()
  roleId: string;

  @ApiProperty()
  routeId: string;

  @ApiProperty({ type: () => Route })
  route?: Route;
}
