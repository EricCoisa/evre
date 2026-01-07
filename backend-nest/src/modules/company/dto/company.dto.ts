import { ApiProperty } from '@nestjs/swagger';
import { CompanyStatusConst } from '../../../domain/company/companyStatus.const';

export class CompanyDto {
  @ApiProperty({
    description: 'ID único da empresa',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Nome da empresa',
    example: 'Acme Corporation',
  })
  name: string;

  @ApiProperty({
    description: 'Status da empresa',
    enum: CompanyStatusConst,
    example: 'DRAFT',
  })
  status: keyof typeof CompanyStatusConst;

  @ApiProperty({
    description: 'Data de criação',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Data da última atualização',
  })
  updatedAt: Date;
}
