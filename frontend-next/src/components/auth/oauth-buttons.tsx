"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CaptchaTokenControl } from "@/hooks/use-captcha";
import { useTranslation } from "@/hooks/use-translation";
import type { OAuthProvider } from "@/lib/actions/auth/types";
import { CAPTCHA_TOKEN_HEADER } from "@/lib/api/captcha-header";
import { toast } from "sonner";

/** Botões de login social; a lista vem do backend já filtrada e vazia com `OAUTH_LOGIN` desligada. */
export function OAuthButtons({
  providers,
  callbackUrl,
  inviteToken,
  intent = inviteToken ? "INVITE" : "LOGIN",
  captchaControl,
}: {
  providers: OAuthProvider[];
  callbackUrl?: string;
  intent?: "LOGIN" | "SIGNUP" | "INVITE";
  /** Presente só na tela de convite: amarra o fluxo ao convidado. */
  inviteToken?: string;
  captchaControl: CaptchaTokenControl;
}) {
  const { t } = useTranslation("login");
  const { getToken, enabled } = captchaControl;
  const [starting, setStarting] = useState(false);

  if (!providers.length) return null;

  const start = async (providerId: string) => {
    if (starting) return;
    setStarting(true);
    try {
      const captchaToken = await getToken();
      if (enabled && !captchaToken) {
        throw new Error(t("common:captchaRequired"));
      }
      const response = await fetch(`/api/auth/oauth/${providerId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(captchaToken ? { [CAPTCHA_TOKEN_HEADER]: captchaToken } : {}),
        },
        body: JSON.stringify({
          ...(callbackUrl ? { callbackUrl } : {}),
          ...(inviteToken ? { inviteToken } : {}),
          intent,
        }),
      });
      if (!response.ok) throw new Error(t("oauthStartFailed"));
      const result = (await response.json()) as { url: string };
      window.location.assign(result.url);
    } catch (error) {
      setStarting(false);
      toast.error(
        error instanceof Error ? error.message : t("oauthStartFailed"),
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("orContinueWith")}
          </span>
        </div>
      </div>
      {providers.map((provider) => (
        <Button
          key={provider.id}
          type="button"
          variant="outline"
          className="w-full"
          disabled={starting}
          onClick={() => void start(provider.id)}
        >
          {t("continueWith", { provider: provider.label })}
        </Button>
      ))}
    </div>
  );
}
