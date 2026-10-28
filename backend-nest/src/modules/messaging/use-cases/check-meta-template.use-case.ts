import { Injectable } from '@nestjs/common';
import type { TemplateButton } from 'src/domain/interface/messaging-provider.interface';
import type {
  CheckMetaTemplateDto,
  MetaTemplateCheckDto,
} from '../dto/messaging-template-submission.dto';
import { checkMetaTemplateRules } from '../providers/meta-template-rules';

/** Checa o rascunho do template contra as mesmas regras da submissão, sem gravar nada. */
@Injectable()
export class CheckMetaTemplateUseCase {
  execute(dto: CheckMetaTemplateDto): MetaTemplateCheckDto {
    return {
      issues: checkMetaTemplateRules({
        category: dto.category,
        body: dto.body,
        header: dto.header,
        footer: dto.footer,
        buttons:
          (dto.buttons as TemplateButton[] | null | undefined) ?? undefined,
      }),
    };
  }
}
