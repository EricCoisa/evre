"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "@/hooks/use-translation";
import { type ValidateInviteResponse } from "@/lib/actions/user/types";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import type { OAuthProvider } from "@/lib/actions/auth/types";
import type { CaptchaConfigDto } from "@/lib/generated/schemas";
import { useCaptcha } from "@/hooks/use-captcha";
import { useRouter } from "next/navigation";

/** Existing accounts must authenticate as the invited email before changing role. */
export function AcceptInviteCard({
  inviteResponse,
  authenticated,
  oauthProviders = [],
  captcha,
}: {
  inviteResponse: ValidateInviteResponse;
  authenticated: boolean;
  oauthProviders?: OAuthProvider[];
  captcha?: CaptchaConfigDto | null;
}) {
  const { t } = useTranslation("signup");
  const router = useRouter();
  const {
    containerRef,
    getToken,
    enabled: captchaEnabled,
  } = useCaptcha(captcha);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const captchaToken = await getToken();
      if (captchaEnabled && !captchaToken) {
        throw new Error(t("common:captchaRequired"));
      }
      const response = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(captchaToken ? { "x-captcha-token": captchaToken } : {}),
        },
        body: JSON.stringify({ token: inviteResponse.token }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || t("common:errorMessage"));
      }
      router.replace("/redirect");
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : t("common:errorMessage"));
    }
  };

  const inviteUrl = `/signup?inviteToken=${encodeURIComponent(inviteResponse.token)}`;
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(inviteUrl)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("acceptInviteTitle")}</CardTitle>
        <CardDescription>
          {authenticated
            ? inviteResponse.companyName
              ? t("acceptInviteDescription", { companyName: inviteResponse.companyName })
              : t("acceptInviteDescriptionGeneric")
            : t("acceptInviteLoginRequired")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={containerRef} className="flex justify-center" />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!authenticated ? (
          <>
            <Button asChild className="w-full">
              <Link href={loginUrl}>{t("signInToAcceptInvite")}</Link>
            </Button>
            <OAuthButtons
              providers={oauthProviders}
              intent="INVITE"
              inviteToken={inviteResponse.token}
              captchaControl={{
                getToken,
                enabled: captchaEnabled,
              }}
            />
          </>
        ) : (
          <>
            <Button
              className="w-full"
              onClick={() => void handleAccept()}
              disabled={isLoading}
            >
              {isLoading
                ? t("acceptInviteSubmitting")
                : t("acceptInviteButton")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
