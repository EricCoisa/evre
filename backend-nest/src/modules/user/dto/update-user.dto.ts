import { createZodDto } from 'nestjs-zod';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';
import { z } from 'zod';

export const UpdateUserSchema = z
  .object({
    // email: z.string().email('validation.email.invalid').optional(),
    // password: z.string().min(6, 'validation.password.min_length').optional(),
    name: z.string().optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    role: z.string().optional(),
    status: z.nativeEnum(UserStatusConst).optional(),
  })
  .strict();

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}

const UpdateProfileSchema = UpdateUserSchema.omit({
  role: true,
  status: true,
}).extend({
  image: z.any().optional(), // Buffer para imagem binária (máx 40MB)
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}

export type UpdateUserDtoType = z.infer<typeof UpdateUserSchema>;

const UpdatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.current_password.required'),
    newPassword: z.string().min(6, 'validation.new_password.min_length'),
    confirmNewPassword: z
      .string()
      .min(6, 'validation.confirm_new_password.min_length'),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'validation.new_passwords_do_not_match',
  });

export type UpdatePasswordDtoType = z.infer<typeof UpdatePasswordSchema>;
export class UpdatePasswordDto extends createZodDto(UpdatePasswordSchema) {}
