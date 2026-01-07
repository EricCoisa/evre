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
import { Input } from "@/components/ui/input";
import { useRouter } from 'next/navigation';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useTranslation } from "@/hooks/use-translation";
import Link from "next/link";
import { forgotPassword } from "@/lib/actions/auth/api";

export function ForgotPasswordForm() {
    const { t } = useTranslation("forgotPassword");
    
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    // Define schema after t() is available for translations
    const forgotPasswordSchema = z.object({
        email: z.string().email(t('invalidEmail')),
    })

    type ForgotPasswordFormType = z.infer<typeof forgotPasswordSchema>;

    const form = useForm<ForgotPasswordFormType>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: '',
        },
    });

    const { handleSubmit, reset } = form;
    const { errors, isSubmitting } = form.formState;

    const onSubmit = async (values: ForgotPasswordFormType) => {
        setError(null);
        setSuccess(false);
        try {
            await forgotPassword({
                email: values.email,
            });
            reset();
            setSuccess(true);
        } catch (err) {
            if (err && typeof err === "object" && "message" in err) {
                setError((err as { message: string }).message);
            } else {
                setError(t('errorSendingResetEmail'));
            }
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('forgotPassword')}</CardTitle>
                <CardDescription>
                    {t('enterInfo')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {success ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                            <p className="text-green-800 dark:text-green-200 text-sm">
                                {t('successMessage')}
                            </p>
                        </div>
                        <Button asChild className="w-full">
                            <Link href="/login">{t('backToLogin')}</Link>
                        </Button>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('email')}</FormLabel>
                                        <FormControl>
                                            <Input id="email" type="email" placeholder="m@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            /> 
                            {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
                            <div className="flex flex-col gap-2">
                                <Button type="submit" disabled={isSubmitting}>{t('sendResetEmailButton')}</Button>
                                <Button asChild variant="outline" type="button">
                                    <Link href="/login">{t('backToLogin')}</Link>
                                </Button>
                            </div>
                        </form>
                    </Form>
                )}
            </CardContent>
        </Card>
    );
}