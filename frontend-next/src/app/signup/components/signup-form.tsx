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
import { signUp } from "@/lib/actions/user/api";
import { Input } from "@/components/ui/input";
import { ValidateInviteResponse } from "@/lib/actions/user/types";
import { useRouter } from 'next/navigation';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useTranslation } from "@/hooks/use-translation";

export function SignupForm({ inviteResponse }: { inviteResponse?: ValidateInviteResponse }) {
    const { t } = useTranslation("signup");
    
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    // Define schema after t() is available for translations
    const signupSchema = z.object({
        name: z.string().min(1, t('nameRequired')),
        email: z.string().email(t('invalidEmail')),
        password: z.string().min(6, t('passwordMin')),
        confirmPassword: z.string().min(6, t('confirmPasswordMin')),
    }).refine((data) => data.password === data.confirmPassword, {
        message: t('passwordsDoNotMatch'),
        path: ['confirmPassword'],
    });

    type SignupFormType = z.infer<typeof signupSchema>;

    const form = useForm<SignupFormType>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            email: inviteResponse?.email ?? '',
        },
    });

    const { handleSubmit, reset } = form;
    const { errors, isSubmitting } = form.formState;

    const onSubmit = async (values: SignupFormType) => {
        setError(null);
        try {
            await signUp({
                email: inviteResponse?.email || values.email,
                password: values.password,
                name: values.name,
                inviteToken: inviteResponse?.token,
            });
            reset();
            router.push('/login');
        } catch (err) {
            if (err && typeof err === "object" && "message" in err) {
                setError((err as { message: string }).message);
            } else {
                setError(t('errorCreatingAccount'));
            }
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('createAccount')}</CardTitle>
                <CardDescription>
                    {t('enterInfo')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('fullName')}</FormLabel>
                                    <FormControl>
                                        <Input id="name" type="text" placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('email')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="m@example.com"
                                            {...field}
                                            readOnly={!!inviteResponse?.email}
                                        />
                                    </FormControl>
                                    <div className="text-xs text-muted-foreground">{t('weWillUseEmail')}</div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('password')}</FormLabel>
                                    <FormControl>
                                        <Input id="password" type="password" {...field} />
                                    </FormControl>
                                    <div className="text-xs text-muted-foreground">{t('mustBeAtLeast6')}</div>
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
                                    <div className="text-xs text-muted-foreground">{t('confirmYourPassword')}</div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
                        <div className="flex flex-col gap-2">
                            <Button type="submit" disabled={isSubmitting}>{t('createAccountButton')}</Button>
                            <div className="px-6 text-center text-sm text-muted-foreground">
                                {t('alreadyHaveAccount')} <a href="/login" className="underline">{t('signIn')}</a>
                            </div>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}