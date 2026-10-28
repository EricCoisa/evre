"use server";

import { getServerAccessToken } from "@/lib/actions/auth/server-auth";
import { getSignupConfiguration } from "@/lib/actions/systemConfiguration/api";
import { redirect } from "next/navigation";
import { SignupForm } from "./components/signup-form";
import { AcceptInviteCard } from "./components/accept-invite-card";
import { validateInvite } from "@/lib/actions/user/api";
import { getOAuthProviders } from "@/lib/actions/auth/api";
import { ValidateInviteResponse } from "@/lib/actions/user/types";
import { Banner } from "@/components/banner";
import { getCaptchaConfig } from "@/lib/actions/captcha/api";

function checkSignupAccess(configValue: unknown, inviteToken?: string, signupIntent?: string) {
  const isInviteConsent = signupIntent === "INVITE";
  if (!configValue && !inviteToken && !isInviteConsent) {
    redirect("/login");
  }
}

async function resolveInviteStatus(inviteToken?: string): Promise<{
  inviteResponse?: ValidateInviteResponse;
  inviteAlreadyMember: boolean;
}> {
  if (!inviteToken) return { inviteAlreadyMember: false };
  try {
    const inviteValidation = await validateInvite(inviteToken);
    if (!inviteValidation.success) {
      if (inviteValidation.status === 409) return { inviteAlreadyMember: true };
      redirect("/login");
    }
    if (!inviteValidation.data.valid) redirect("/login");
    return { inviteResponse: inviteValidation.data, inviteAlreadyMember: false };
  } catch {
    redirect("/login");
  }
}

function checkSessionRedirect(
  accessToken: string | null | undefined,
  userExists: boolean | undefined,
  isProviderConsent: boolean,
  inviteAlreadyMember: boolean,
) {
  if (accessToken && !userExists && !isProviderConsent && !inviteAlreadyMember) {
    redirect("/redirect");
  }
}

async function loadSignupOAuthProviders(
  configValue: boolean,
  inviteToken?: string,
  signupIntent?: string,
) {
  const canUseOAuth = configValue === true || Boolean(inviteToken) || signupIntent === "INVITE";
  if (!canUseOAuth) return [];
  const providers = (await getOAuthProviders()).data ?? [];
  return providers.filter((p) => p.configured && p.enabled);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Record<string, string> | Promise<Record<string, string>>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const { inviteToken, signupToken, provider: providerId, signupIntent } = resolvedSearchParams;
  const isProviderConsent = signupIntent === "SIGNUP" || signupIntent === "INVITE";

  const config = (await getSignupConfiguration()).data;
  checkSignupAccess(config.value, inviteToken, signupIntent);

  const { inviteResponse, inviteAlreadyMember } = await resolveInviteStatus(inviteToken);
  const accessToken = await getServerAccessToken();
  checkSessionRedirect(accessToken, inviteResponse?.userExists, isProviderConsent, inviteAlreadyMember);

  const oauthProviders = await loadSignupOAuthProviders(Boolean(config.value), inviteToken, signupIntent);
  const captcha = (await getCaptchaConfig()).data;
  const providerLabel = oauthProviders.find((provider) => provider.id === providerId)?.label;

  return (
    <div className="min-h-screen flex">
      <Banner />
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 bg-background">
        <div className="w-full">
          {inviteResponse?.userExists ? (
            <AcceptInviteCard
              inviteResponse={inviteResponse}
              authenticated={Boolean(accessToken)}
              oauthProviders={oauthProviders}
              captcha={captcha}
            />
          ) : (
            <SignupForm
              inviteResponse={inviteResponse}
              oauthProviders={oauthProviders}
              captcha={captcha}
              signupToken={signupToken}
              isProviderConsent={isProviderConsent}
              inviteAlreadyMember={inviteAlreadyMember}
              providerLabel={providerLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
