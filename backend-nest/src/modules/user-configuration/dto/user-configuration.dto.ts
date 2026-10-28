import { ApiProperty } from '@nestjs/swagger';
import type { RequirementsResult } from '../../capability/resolve-requirements.util';

export class UserConfigurationDto {
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
    nullable: true,
  })
  value: number | string | boolean | object | null;

  @ApiProperty({
    description: 'Indica se o valor foi personalizado pelo usuário',
    example: true,
  })
  isCustomized: boolean;

  @ApiProperty({
    description: 'Indica se o valor é obrigatório',
    example: true,
  })
  isRequired: boolean;

  @ApiProperty({
    description: 'Indica se o valor da definição é secreto',
    example: false,
    required: false,
  })
  isSecret?: boolean;

  @ApiProperty({
    description:
      'Estado das capabilities exigidas por esta chave. Ausente sem requisito registrado.',
    required: false,
  })
  requirements?: RequirementsResult;
}
