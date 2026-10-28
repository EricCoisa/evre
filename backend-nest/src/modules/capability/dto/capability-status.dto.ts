import { ApiProperty } from '@nestjs/swagger';

/** Forma de cada entrada de `GET /capabilities` — espelha `CapabilityStatus`. */
export class CapabilityStatusDto {
  @ApiProperty()
  available: boolean;

  @ApiProperty()
  operational: boolean;

  @ApiProperty({ required: false })
  reason?: string;
}
