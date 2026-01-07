import { ApiProperty } from '@nestjs/swagger';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';
import { User } from 'src/domain/user/user.entity';

export class UserDto {
  constructor(user?: User) {
    if (!user) return;
    Object.assign(this, {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false, nullable: true })
  name: string | null;

  @ApiProperty({ enum: UserRoleConst })
  role: string;

  @ApiProperty({ enum: UserStatusConst })
  status: string;
  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
