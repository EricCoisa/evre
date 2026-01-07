import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateRouteSchema = z.object({
  path: z.string().min(1).describe('Caminho da rota (ex: /dashboard/user)'),
  labelKey: z.string().min(1).describe('Chave de tradução da rota'),
  icon: z.string().optional().describe('Nome do ícone lucide-react'),
  parentId: z.string().uuid().optional().describe('ID da rota pai'),
  ordem: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('Ordem de exibição na sidebar'),
  isHome: z
    .boolean()
    .optional()
    .default(false)
    .describe('Define se é a página inicial'),
  isActive: z.boolean().optional().default(true).describe('Rota ativa'),
});

export class CreateRouteDto extends createZodDto(CreateRouteSchema) {}
