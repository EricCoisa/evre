import { ApiProperty } from '@nestjs/swagger';

export class VerificationRequestResponseDto {
  @ApiProperty()
  expiresAt: Date;
}
