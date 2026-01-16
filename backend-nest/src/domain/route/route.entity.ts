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
  isHome: boolean;

  @ApiProperty()
  isClientHome: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  showSideBar: boolean | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
