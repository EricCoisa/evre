import { ApiProperty } from '@nestjs/swagger';

export class VerificationHealthResponseDto {
  @ApiProperty()
  operational: boolean;

  @ApiProperty({ required: false })
  reason?: string;
}
