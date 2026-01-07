import { ApiProperty } from '@nestjs/swagger';
import { UserRoleConst } from 'src/domain/auth/userRole.const';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';

export class User {
  @ApiProperty({
    description: 'ID único do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Hash da senha (não retornado em DTOs públicos)',
    example: '$2b$10$...',
    required: false,
  })
  password?: string;

  @ApiProperty({ required: false, nullable: true })
  name?: string | null;

  @ApiProperty({
    description: 'Imagem de perfil do usuário em formato binário',
    required: false,
    nullable: true,
    type: 'string',
    format: 'binary',
  })
  image?: Buffer | null;

  @ApiProperty({ enum: UserRoleConst })
  role: keyof typeof UserRoleConst;

  @ApiProperty({ enum: UserStatusConst })
  status: keyof typeof UserStatusConst;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
