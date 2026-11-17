import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsConfigDto {
  @ApiProperty({
    description: 'Measurement ID do Google Analytics 4 (vazio = desativado)',
    example: 'G-XXXXXXXXXX',
  })
  ga4Id: string;

  @ApiProperty({
    description: 'Project ID do Microsoft Clarity (vazio = desativado)',
    example: 'abc123xyz9',
  })
  clarityId: string;
}
