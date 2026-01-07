import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { CompanyStatusConst } from '../../../domain/company/companyStatus.const';

export class UpdateCompanyDto {
  @ApiProperty({
    description: 'Nome da empresa',
    example: 'Acme Corporation',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Nome deve ser uma string' })
  @MaxLength(255, { message: 'Nome deve ter no máximo 255 caracteres' })
  name?: string;

  @ApiProperty({
    description: 'Status da empresa',
    enum: CompanyStatusConst,
    example: 'ACTIVE',
    required: false,
  })
  @IsOptional()
  @IsEnum(CompanyStatusConst, {
    message: 'Status inválido',
  })
  status?: keyof typeof CompanyStatusConst;
}
