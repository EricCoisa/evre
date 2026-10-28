import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const SignupsSeriesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type SignupsSeriesQuery = z.infer<typeof SignupsSeriesQuerySchema>;

export class SeriesPointDto {
  @ApiProperty({ example: '2026-08-13' }) date: string;
  @ApiProperty({ example: 4 }) value: number;
}

export class SignupsSeriesDto {
  @ApiProperty({ type: [SeriesPointDto] }) data: SeriesPointDto[];
}
