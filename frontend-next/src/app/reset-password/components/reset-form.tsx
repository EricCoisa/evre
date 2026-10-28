"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check } from "lucide-react";
import { z } from "zod";
import { resetPassword } from "@/lib/actions/auth/api";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
import { Alive } from "@/lib/api/collector";
import { FormBuilder } from "@/components/form/form-builder";
import { useCaptcha } from "@/hooks/use-captcha";
import type { CaptchaConfigDto } from "@/lib/generated/schemas";

export function ResetPasswordForm({
  token,
  captcha,
}: {
  token: string;
  captcha?: CaptchaConfigDto | null;
}) {
  const { t } = useTranslation("resetPassword");
  const router = useRouter();
  const { containerRef, getToken, enabled } = useCaptcha(captcha);

  const schema = z
    .object({
      password: z
        .string()
        .min(8, t("passwordMin"))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
          t("passwordRequirements"),
        ),
      confirmPassword: z.string().min(8, t("confirmPasswordMin")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("resetPassword")}</CardTitle>
        <CardDescription>{t("enterInfo")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormBuilder
          schema={schema}
          fields={[
            {
              name: "password",
              label: t("password"),
              type: "password",
              description: t("passwordRequirements"),
            },
            {
              name: "confirmPassword",
              label: t("confirmPassword"),
              type: "password",
            },
            {
              name: "captcha",
              label: "",
              type: "custom" as const,
              render: () => (
                <div ref={containerRef} className="flex justify-center" />
              ),
            },
          ]}
          onSubmit={async (values) => {
            const captchaToken = await getToken();
            if (enabled && !captchaToken)
              throw new Error(t("common:captchaRequired"));
            await Alive(() =>
              resetPassword({ token, password: values.password }, captchaToken),
            )();
          }}
          onSuccess={() => {
            setTimeout(() => router.push("/login"), 2000);
          }}
          submitLabel={t("resetButton")}
          actions={{ mode: "submit-only" }}
          successView={
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                {t("successMessage")}
                <br />
                <span className="text-sm text-muted-foreground">
                  {t("redirecting")}
                </span>
              </AlertDescription>
            </Alert>
          }
        />
      </CardContent>
    </Card>
  );
}
