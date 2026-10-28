import { ApiProperty } from '@nestjs/swagger';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';
import { User } from 'src/domain/user/user.entity';

interface UserWithRelations extends User {
  roleRecord?: { name: string };
  imageUrl?: string | null;
}

export class UserDto {
  constructor(user?: User) {
    if (!user) return;
    const extended = user as UserWithRelations;
    Object.assign(this, {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      role: extended.roleRecord?.name ?? user.role ?? '',
      status: user.status,
      imageUrl: extended.imageUrl ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  // `type: String` explícito: sem ele o reflect-metadata emite Object para `string | null`
  // e o client gerado recebe `{ [key: string]: unknown }` em vez de `string`.
  @ApiProperty({ type: String, required: false, nullable: true })
  name: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  phone?: string | null;

  // `enum` explícito como em `status`: sem ele o contrato diz `string` e o client gerado
  // não consegue casar com os formulários, que trabalham com a união dos papéis.
  @ApiProperty({ enum: UserRoleConst })
  role: string;

  @ApiProperty({ enum: UserStatusConst })
  status: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  imageUrl?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
