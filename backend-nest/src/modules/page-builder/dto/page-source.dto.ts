import { ApiProperty } from '@nestjs/swagger';

/** Espelha PageSourceParam — só existe para o Swagger/Orval tiparem a resposta. */
export class PageSourceParamDto {
  @ApiProperty({ example: 'limit' }) name: string;
  @ApiProperty({ enum: ['number', 'string', 'boolean'] })
  type: 'number' | 'string' | 'boolean';
  @ApiProperty({ example: 'Quantidade de linhas, inteiro de 1 a 50.' })
  description: string;
}

/** Uma fonte de dados liberada para o PageBuilder, já filtrada pelo role de quem perguntou. */
export class PageSourceDto {
  @ApiProperty({ example: 'logs.list' }) key: string;
  @ApiProperty({ enum: ['list', 'count', 'series'] })
  kind: 'list' | 'count' | 'series';
  @ApiProperty({ example: 'Logs de auditoria do sistema.' })
  description: string;
  @ApiProperty({
    type: [String],
    description:
      'Campos que podem virar coluna de tabela. É o que impede o editor de oferecer ' +
      'um nome de campo que não existe (coluna vazia na tela).',
  })
  fields: string[];
  @ApiProperty({ type: [PageSourceParamDto] }) params: PageSourceParamDto[];
}
