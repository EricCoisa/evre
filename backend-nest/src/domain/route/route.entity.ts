import { ApiProperty } from '@nestjs/swagger';

export class Route {
  @ApiProperty()
  id: string;

  @ApiProperty()
  path: string;

  @ApiProperty()
  labelKey: string;

  @ApiProperty({ required: false })
  icon?: string | null;

  @ApiProperty({ required: false })
  parentId?: string | null;

  @ApiProperty()
  ordem: number;

  @ApiProperty()
  isActive: boolean;

  // Não-nulo no banco (`Boolean @default(true)` em route.prisma).
  @ApiProperty()
  showSideBar: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
