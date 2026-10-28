import { ApiProperty } from '@nestjs/swagger';

export class EnumItemDto {
  @ApiProperty() value: string;
  @ApiProperty() label: string;
}
