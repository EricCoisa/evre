import { ApiProperty } from '@nestjs/swagger';
import { ContractStatusConst } from 'src/domain/contract-document/contractStatus.const';
import { ContractDocument } from 'src/domain/contract-document/contract-document.entity';

export class ContractDocumentDto {
  constructor(contract?: ContractDocument) {
    if (!contract) return;
    Object.assign(this, {
      id: contract.id,
      projectId: contract.projectId,
      proposalId: contract.proposalId,
      name: contract.name,
      version: contract.version,
      status: contract.status,
      contentSchemaVersion: contract.contentSchemaVersion,
      content: contract.content,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    });
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty({ nullable: true })
  proposalId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  version: number;

  @ApiProperty({ enum: ContractStatusConst })
  status: string;

  @ApiProperty()
  contentSchemaVersion: string;

  @ApiProperty({ description: 'JSON content stored as string' })
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
