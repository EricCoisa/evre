import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DeleteAccountSchema = z.object({
  password: z.string().min(1, 'auth.validation.password_required'),
});

export class DeleteAccountDto extends createZodDto(DeleteAccountSchema) {}
