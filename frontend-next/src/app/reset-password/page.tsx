"use server"

import { ResetPasswordForm } from "./components/reset-form"
import { Banner } from "@/components/banner"
import { checkResetToken } from "@/lib/actions/auth/api"
import { InvalidTokenMessage } from "./components/invalid-token-message"

export default async function ResetPasswordPage({ params, searchParams }: { params: { inviteToken?: string }, searchParams?: Record<string, string> | Promise<Record<string, string>> }) {  
    const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
    const resetToken = resolvedSearchParams.token

    let isTokenValid = false

    if (resetToken) {
        try {
            const response = await checkResetToken(resetToken);
            isTokenValid = response.data?.valid ?? false
        } catch (error) {
            isTokenValid = false
        }
    }

    return (
        <div className="min-h-screen flex">
            <Banner />
            <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 bg-background">
                <div className="w-full">
                    {isTokenValid ? (
                        <ResetPasswordForm token={resetToken} />
                    ) : (
                        <InvalidTokenMessage />
                    )}
                </div>
            </div>
        </div>
    )
}

