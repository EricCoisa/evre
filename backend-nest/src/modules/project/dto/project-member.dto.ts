import { ApiProperty } from '@nestjs/swagger';

export class ProjectMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  name: string | null;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  imageUrl: string | null;
}
