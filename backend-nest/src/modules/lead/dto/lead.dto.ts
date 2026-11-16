import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class LeadDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty({ required: false })
  phone?: string | null;

  @Expose()
  @ApiProperty({ required: false })
  email?: string | null;

  @Expose()
  @ApiProperty()
  message: string;

  @Expose()
  @ApiProperty({ enum: ['NEW', 'VIEWED', 'RESOLVED'] })
  status: string;

  @Expose()
  @ApiProperty({ required: false })
  messagingContactId?: string | null;

  @Expose()
  @ApiProperty({ required: false })
  resolvedById?: string | null;

  @Expose()
  @ApiProperty({ required: false })
  resolvedAt?: Date | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
