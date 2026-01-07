"use client"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/lib/actions/auth/api";
import { Input } from "@/components/ui/input";
import { useRouter } from 'next/navigation';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useTranslation } from "@/hooks/use-translation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, TriangleAlert } from "lucide-react";
import { Alive } from "@/lib/api/collector";

export function ResetPasswordForm({ token }: { token: string }) {
    const { t } = useTranslation("resetPassword");
    
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    // Define schema after t() is available for translations
    const resetPasswordSchema = z.object({
        password: z.string()
            .min(8, t('passwordMin'))
            .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/, 
                t('passwordRequirements')),
        confirmPassword: z.string().min(8, t('confirmPasswordMin')),
    }).refine((data) => data.password === data.confirmPassword, {
        message: t('passwordsDoNotMatch'),
        path: ['confirmPassword'],
    });

    type ResetPasswordFormType = z.infer<typeof resetPasswordSchema>;

    const form = useForm<ResetPasswordFormType>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        },
    });

    const { handleSubmit, reset } = form;
    const { errors, isSubmitting } = form.formState;

    const onSubmit = async (values: ResetPasswordFormType) => {
        setError(null);
        try {
            const result = await Alive(() => resetPassword({
                token,
                password: values.password,
            }))();
            
            if (result.message) {
                setSuccess(true);
                reset();
                // Redireciona após 2 segundos
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            }
        } catch (err) {
            if (err && typeof err === "object" && "message" in err) {
                setError((err as { message: string }).message);
            } else {
                setError(t('errorResettingPassword'));
            }
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('resetPassword')}</CardTitle>
                <CardDescription>
                    {t('enterInfo')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {success ? (
                    <div className="space-y-4">
                        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                            <Check className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800 dark:text-green-200">
                                {t('successMessage')}
                                <br />
                                <span className="text-sm">{t('redirecting')}</span>
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('password')}</FormLabel>
                                        <FormControl>
                                            <Input id="password" type="password" {...field} />
                                        </FormControl>
                                        <div className="text-xs text-muted-foreground">{t('passwordRequirements')}</div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('confirmPassword')}</FormLabel>
                                        <FormControl>
                                            <Input id="confirm-password" type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {error && (
                                <Alert variant="destructive">
                                    <TriangleAlert className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? t('redirecting') : t('resetButton')}
                            </Button>
                        </form>
                    </Form>
                )}
            </CardContent>
        </Card>
    );
}