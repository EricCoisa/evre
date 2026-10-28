import { z } from 'zod';

export const PresignedUrlQuerySchema = z.object({
  // Recusa key com sequência de path traversal ("..").
  key: z
    .string()
    .min(1)
    .refine((v) => !v.includes('..'), {
      message: 'key não pode conter ".."',
    }),
});

export type PresignedUrlQuery = z.infer<typeof PresignedUrlQuerySchema>;
