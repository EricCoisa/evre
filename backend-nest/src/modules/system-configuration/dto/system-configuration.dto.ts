import { ApiProperty } from '@nestjs/swagger';
import type { RequirementsResult } from '../../capability/resolve-requirements.util';

export class SystemConfigurationDto {
  @ApiProperty({
    description: 'ID único da configuração',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Chave de identificação da configuração',
    example: 'system.maintenance.mode',
  })
  labelKey: string;

  @ApiProperty({
    description: 'Tipo do valor (STRING, NUMBER, BOOLEAN, JSON, DATE, ENUM)',
    example: 'BOOLEAN',
  })
  valueType: string;

  @ApiProperty({
    description: 'Opções disponíveis para valueType ENUM',
    example: ['light', 'dark'],
    isArray: true,
    required: false,
  })
  options?: string[];

  @ApiProperty({
    description: 'Valor da configuração',
    example: 'false',
  })
  value: number | string | boolean | object;

  @ApiProperty({
    description: 'Data da última atualização',
    example: '2025-12-05T11:49:53.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Indica se a configuração é secreta (oculta em listagens)',
    example: false,
  })
  secret?: boolean;

  @ApiProperty({
    description:
      'Indica se a configuração está bloqueada (não pode ser alterada)',
    example: false,
  })
  blocked?: boolean;

  @ApiProperty({
    description:
      'Estado das capabilities exigidas por esta chave. Ausente sem requisito registrado, ou para quem acessa sem sessão.',
    required: false,
  })
  requirements?: RequirementsResult;
}
