"use server";

import { ResetPasswordForm } from "./components/reset-form";
import { Banner } from "@/components/banner";
import { checkResetToken } from "@/lib/actions/auth/api";
import { InvalidTokenMessage } from "./components/invalid-token-message";
import { getCaptchaConfig } from "@/lib/actions/captcha/api";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Record<string, string> | Promise<Record<string, string>>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const resetToken = resolvedSearchParams.token;

  let isTokenValid = false;
  const captcha = (await getCaptchaConfig()).data;

  if (resetToken) {
    try {
      const response = await checkResetToken(resetToken);
      isTokenValid = response.data?.valid ?? false;
    } catch {
      isTokenValid = false;
    }
  }

  return (
    <div className="min-h-screen flex">
      <Banner />
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 bg-background">
        <div className="w-full">
          {isTokenValid ? (
            <ResetPasswordForm token={resetToken} captcha={captcha} />
          ) : (
            <InvalidTokenMessage />
          )}
        </div>
      </div>
    </div>
  );
}
