import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateRouteSchema = z.object({
  path: z.string().min(1).optional().describe('Caminho da rota'),
  labelKey: z.string().min(1).optional().describe('Chave de tradução da rota'),
  icon: z.string().nullable().optional().describe('Nome do ícone lucide-react'),
  parentId: z.string().uuid().nullable().optional().describe('ID da rota pai'),
  ordem: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Ordem de exibição na sidebar'),
  isActive: z.boolean().optional().describe('Rota ativa'),
  showSideBar: z.boolean().optional().describe('Exibir na sidebar'),
});

export class UpdateRouteDto extends createZodDto(UpdateRouteSchema) {}
