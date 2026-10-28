"use client"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { z } from "zod"
import { forgotPassword } from "@/lib/actions/auth/api"
import { useTranslation } from "@/hooks/use-translation"
import { FormBuilder } from "@/components/form/form-builder"
import { useCaptcha } from "@/hooks/use-captcha"
import type { CaptchaConfigDto } from "@/lib/generated/schemas"

export function ForgotPasswordForm({ captcha }: { captcha?: CaptchaConfigDto | null }) {
    const { t } = useTranslation("forgotPassword")
    const { containerRef, getToken, enabled: captchaEnabled } = useCaptcha(captcha)

    const schema = z.object({
        email: z.string().email(t('invalidEmail')),
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('forgotPassword')}</CardTitle>
                <CardDescription>{t('enterInfo')}</CardDescription>
            </CardHeader>
            <CardContent>
                <FormBuilder
                    schema={schema}
                    fields={[
                        { name: 'email', label: t('email'), type: 'email', placeholder: t('emailPlaceholder') },
                        // Último campo: o widget nasce logo acima do botão de envio.
                        { name: 'captcha', label: '', type: 'custom', render: () => <div ref={containerRef} className="flex justify-center" /> },
                    ]}
                    onSubmit={async (values) => {
                        const captchaToken = await getToken()
                        // FormBuilder transforma este throw em toast de erro.
                        if (captchaEnabled && !captchaToken) throw new Error(t('common:captchaRequired'))

                        const res = await forgotPassword({ email: values.email }, captchaToken)
                        if (!res.success) throw new Error(res.message ?? t('common:errorMessage'))
                    }}
                    submitLabel={t('sendResetEmailButton')}
                    actions={{
                        mode: 'submit+link',
                        link: { label: t('backToLogin'), href: '/login' },
                    }}
                    successView={
                        <div className="space-y-4">
                            <Alert>
                                <AlertDescription>{t('successMessage')}</AlertDescription>
                            </Alert>
                            <Button asChild className="w-full">
                                <Link href="/login">{t('backToLogin')}</Link>
                            </Button>
                        </div>
                    }
                />
            </CardContent>
        </Card>
    )
}
