"use server"

import { getServerAccessToken } from "@/lib/actions/auth/server-auth"
import { getSignupConfiguration } from "@/lib/actions/systemConfiguration/api"
import { redirect } from "next/navigation"
import { SignupForm } from "./components/signup-form"
import { validateInvite } from "@/lib/actions/user/api"
import { ValidateInviteResponse } from "@/lib/actions/user/types"
import { Banner } from "@/components/banner"

export default async function SignupPage({ params, searchParams }: { params: { inviteToken?: string }, searchParams?: Record<string, string> | Promise<Record<string, string>> }) {  
    const accessToken = await getServerAccessToken();
    if (accessToken)
        redirect('/redirect');

    const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
    const inviteToken = resolvedSearchParams.inviteToken

    const config = (await getSignupConfiguration()).data;

    if (config.value == false && (inviteToken === "" || inviteToken == null))
        redirect('/login');

    let inviteResponse: ValidateInviteResponse | undefined = undefined;
    try {
        if (inviteToken) {
            inviteResponse = (await validateInvite(inviteToken)).data;
        }
    } catch (error) {
        redirect('/login');
    }

    if (inviteResponse && !inviteResponse.valid)
        redirect('/login');

    return (
        <div className="min-h-screen flex">
            <Banner />
            <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 bg-background">
                <div className="w-full">
                    <SignupForm inviteResponse={inviteResponse} />
                </div>
            </div>
        </div>
    )
}

