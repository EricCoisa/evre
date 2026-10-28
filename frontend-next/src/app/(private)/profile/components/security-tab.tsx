'use client';

import { Container } from "@/components/container";
import { useTranslation } from '@/hooks/use-translation';
import z from "zod";
import { type FieldConfig } from "@/lib/form/field-config";
import { useMemo } from "react";
import { updatePassword } from "@/lib/actions/user/api";
import { toast } from "sonner";
import { useMe } from "@/lib/actions/auth/queries";
import { Alive } from "@/lib/api/collector";
import { FormBuilder } from "@/components/form/form-builder";

export function SecurityTab() {
  const { t } = useTranslation('profile');
  const { data: user } = useMe();

  const updatePasswordSchema = useMemo(() => z.object({
    currentPassword: z.string().min(1, t('currentPasswordRequired')),
    newPassword: z.string()
      .min(8, t('passwordMin'))
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
        t('passwordRequirements')
      ),
    confirmNewPassword: z.string().min(8, t('confirmPasswordMin')),
  }).refine(
    (data) => data.newPassword === data.confirmNewPassword,
    { message: t('passwordsDoNotMatch'), path: ['confirmNewPassword'] }
  ), [t]);

  const updatePasswordFieldConfig = useMemo(() => ({
    currentPassword: { label: t('currentPasswordLabel'), type: 'password' as const, placeholder: t('currentPasswordPlaceholder') },
    newPassword: { label: t('newPasswordLabel'), type: 'password' as const, placeholder: t('newPasswordPlaceholder') },
    confirmNewPassword: { label: t('confirmPasswordLabel'), type: 'password' as const, placeholder: t('confirmPasswordPlaceholder') },
  } satisfies FieldConfig<typeof updatePasswordSchema>), [t]);

  if (!user) return null;

  return (
    <Container variant="form" padding>
      <FormBuilder
        schema={updatePasswordSchema}
        fieldConfig={updatePasswordFieldConfig}
        mode="create"
        onSubmit={async (data) => {
          const result = await Alive(() => updatePassword(user.id, data))();
          return result;
        }}
        onSuccess={() => {
          toast.success(t('common:updatedSuccessfully'));
        }}
        submitLabel={t('updatePassword')}
        actions={{ mode: 'submit-only' }}
      />
    </Container>
  );
}
