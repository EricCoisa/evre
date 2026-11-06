import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SendProposalSchema = z.object({
  /** Sem telefone, usa o contato principal da empresa (`Contact.isPrimary`). */
  phone: z.string().min(1).optional(),
  /** Id do template a enviar; omitido usa `PROPOSAL_SENT_TEMPLATE_KEY`. */
  templateId: z.string().uuid().optional(),
  /** Variáveis custom do template (além de `title` e `link`, que sempre vêm da proposta). */
  values: z.record(z.string()).optional(),
  /** URL pública da imagem para header IMAGE do template; exigido quando o template usa IMAGE. */
  headerImageUrl: z.string().url().optional(),
});

export class SendProposalDto extends createZodDto(SendProposalSchema) {}
