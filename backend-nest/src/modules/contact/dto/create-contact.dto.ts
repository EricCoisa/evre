import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateContactSchema = z.object({
	name: z.string().min(2).max(100),
	email: z.string().email().max(100),
	telefone: z.string().min(6).max(30),
	text: z.string().min(1).max(2000),
});

export class CreateContactDto extends createZodDto(CreateContactSchema) {}
