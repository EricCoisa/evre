"use server"

import { getServerAccessToken } from "@/lib/actions/auth/server-auth"
import { redirect } from "next/navigation"
import { ForgotPasswordForm } from "./components/forgot-form"
import { Banner } from "@/components/banner"
import { getCaptchaConfig } from "@/lib/actions/captcha/api"
import { getForgotPasswordStatus } from "@/lib/actions/auth/api"

export default async function ForgotPasswordPage() {  
        const accessToken = await getServerAccessToken();
    if (accessToken)
        redirect('/redirect');

    const forgotPasswordStatus = (await getForgotPasswordStatus()).data;
    if (!forgotPasswordStatus?.available) {
        redirect('/login');
    }

    const captcha = (await getCaptchaConfig()).data;

    return (
        <div className="min-h-screen flex">
            <Banner />
            <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 bg-background">
                <div className="w-full">
                    <ForgotPasswordForm captcha={captcha} />
                </div>
            </div>
        </div>
    )
}

