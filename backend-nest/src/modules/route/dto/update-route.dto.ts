import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateRouteSchema = z.object({
  path: z.string().min(1).optional().describe('Caminho da rota'),
  labelKey: z.string().min(1).optional().describe('Chave de tradução da rota'),
  icon: z.string().optional().nullable().describe('Nome do ícone lucide-react'),
  parentId: z.string().uuid().nullable().optional().describe('ID da rota pai'),
  ordem: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Ordem de exibição na sidebar'),
  isHome: z.boolean().optional().describe('Define se é a página inicial'),
  isActive: z.boolean().optional().describe('Rota ativa'),
  showSideBar: z.boolean().optional().describe('Exibir na sidebar'),
  isClientHome: z
    .boolean()
    .optional()
    .describe('Define se é a página inicial do cliente'),
});

export class UpdateRouteDto extends createZodDto(UpdateRouteSchema) {}
