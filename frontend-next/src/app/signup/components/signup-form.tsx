"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  completeEmailSignup,
  signUp,
  type SignupResult,
} from "@/lib/actions/user/api";
import { type ValidateInviteResponse } from "@/lib/actions/user/types";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
import {
  FormBuilder,
  type FormBuilderField,
} from "@/components/form/form-builder";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import type { OAuthProvider } from "@/lib/actions/auth/types";
import type { CaptchaConfigDto } from "@/lib/generated/schemas";
import { useCaptcha } from "@/hooks/use-captcha";

type TranslateFn = ReturnType<typeof useTranslation>["t"];

function validateSignupPasswordFields(
  data: Record<string, unknown>,
  ctx: z.RefinementCtx,
  t: (key: string) => string,
) {
  const password = typeof data.password === "string" ? data.password : "";
  const confirmPassword = typeof data.confirmPassword === "string" ? data.confirmPassword : "";

  if (password.length < 6) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("passwordMin"),
      path: ["password"],
    });
  }
  if (confirmPassword.length < 6) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("confirmPasswordMin"),
      path: ["confirmPassword"],
    });
  }
  if (password && confirmPassword && password !== confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });
  }
  if (data.acceptTerms !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("termsRequired"),
      path: ["acceptTerms"],
    });
  }
}

function validateProviderConsentFields(
  data: Record<string, unknown>,
  ctx: z.RefinementCtx,
  t: (key: string) => string,
) {
  if (data.acceptTerms !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("termsRequired"),
      path: ["acceptTerms"],
    });
  }
}

function validateEmailRequestFields(
  data: Record<string, unknown>,
  ctx: z.RefinementCtx,
  t: (key: string) => string,
) {
  if (!String(data.name ?? "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("nameRequired"),
      path: ["name"],
    });
  }
  if (!data.email || !z.string().email().safeParse(data.email).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("invalidEmail"),
      path: ["email"],
    });
  }
}

function validateWaInviteEmail(
  data: Record<string, unknown>,
  ctx: z.RefinementCtx,
  t: (key: string) => string,
) {
  if (!data.email || !z.string().email().safeParse(data.email).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("invalidEmail"),
      path: ["email"],
    });
  }
}

function validateSignupFormSchema(
  data: Record<string, unknown>,
  ctx: z.RefinementCtx,
  {
    isProviderConsent,
    isEmailRequest,
    isWaInvite,
    t,
  }: {
    isProviderConsent: boolean;
    isEmailRequest: boolean;
    isWaInvite: boolean;
    t: (key: string) => string;
  },
) {
  if (isProviderConsent) {
    validateProviderConsentFields(data, ctx, t);
    return;
  }
  if (isEmailRequest) {
    validateEmailRequestFields(data, ctx, t);
    return;
  }
  // WA invite: user provides email themselves
  if (isWaInvite) {
    validateWaInviteEmail(data, ctx, t);
  }
  validateSignupPasswordFields(data, ctx, t);
}

async function executeProviderConsentSubmit(
  values: Record<string, unknown>,
  captchaToken?: string | null,
  t?: (key: string) => string,
) {
  const response = await fetch("/api/auth/oauth/signup/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(captchaToken ? { "x-captcha-token": captchaToken } : {}),
    },
    body: JSON.stringify({
      acceptTerms: values.acceptTerms === true,
    }),
  });
  if (!response.ok) throw new Error(t ? t("providerSignupFailed") : "Provider signup failed");
  return await response.json();
}

async function executeStandardOrEmailSignup({
  values,
  captchaToken,
  isEmailConfirmation,
  signupToken,
  inviteResponse,
  isEmailRequest,
}: {
  values: Record<string, unknown>;
  captchaToken?: string | null;
  isEmailConfirmation: boolean;
  signupToken?: string;
  inviteResponse?: ValidateInviteResponse;
  isEmailRequest: boolean;
}) {
  const email = inviteResponse?.email || (values.email as string);
  if (isEmailConfirmation) {
    return await completeEmailSignup(
      {
        token: signupToken!,
        password: values.password as string,
        acceptTerms: true,
      },
      captchaToken,
    );
  }
  return await signUp(
    {
      email,
      name: values.name as string,
      inviteToken: inviteResponse?.token,
      ...(isEmailRequest
        ? {}
        : {
            password: values.password as string,
            acceptTerms: values.acceptTerms as boolean,
          }),
    },
    captchaToken,
  );
}

async function executeSignupSubmit({
  values,
  captchaToken,
  isProviderConsent,
  isEmailConfirmation,
  signupToken,
  inviteResponse,
  isEmailRequest,
  t,
}: {
  values: Record<string, unknown>;
  captchaToken?: string | null;
  isProviderConsent: boolean;
  isEmailConfirmation: boolean;
  signupToken?: string;
  inviteResponse?: ValidateInviteResponse;
  isEmailRequest: boolean;
  t: (key: string) => string;
}) {
  if (isProviderConsent) {
    return executeProviderConsentSubmit(values, captchaToken, t);
  }

  const result = await executeStandardOrEmailSignup({
    values,
    captchaToken,
    isEmailConfirmation,
    signupToken,
    inviteResponse,
    isEmailRequest,
  });

  if (!result.success) throw new Error(result.message);
  return {
    ...(result.data as SignupResult),
    email: inviteResponse?.email || (values.email as string),
  };
}

function PendingEmailCard({
  email,
  onSignIn,
  t,
}: {
  email: string;
  onSignIn: () => void;
  t: TranslateFn;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pendingEmailTitle")}</CardTitle>
        <CardDescription>
          {t("confirmationPending", { email })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="link"
          className="px-0"
          onClick={onSignIn}
        >
          {t("signIn")}
        </Button>
      </CardContent>
    </Card>
  );
}

function InviteAlreadyMemberCard({ t }: { t: (key: string) => string }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <Alert>
          <AlertDescription>{t("inviteAlreadyMember")}</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">{t("signIn")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function getSignupLabels({
  isEmailConfirmation,
  isProviderConsent,
  isEmailRequest,
  providerLabel,
  t,
}: {
  isEmailConfirmation: boolean;
  isProviderConsent: boolean;
  isEmailRequest: boolean;
  providerLabel?: string;
  t: TranslateFn;
}) {
  const title = isEmailConfirmation ? t("completeSignup") : t("createAccount");
  const description = isEmailConfirmation
    ? t("completeSignupDescription")
    : isProviderConsent
      ? t("providerSignupConsent", {
          provider: providerLabel ?? t("providerFallback"),
        })
      : t("enterInfo");
  const submitLabel = isEmailRequest
    ? t("continueButton")
    : isEmailConfirmation
      ? t("confirmEmailButton")
      : t("createAccountButton");

  return { title, description, submitLabel };
}

function buildSignupTermsField(t: (key: string) => string): FormBuilderField {
  return {
    name: "acceptTerms",
    label: "",
    type: "custom" as const,
    render: (field) => (
      <div className="flex items-center gap-2">
        <Checkbox
          checked={field.value as boolean}
          onCheckedChange={field.onChange}
        />
        <span className="text-sm">
          <a
            href="/legal/termo-uso"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("acceptTerms")}
          </a>
        </span>
      </div>
    ),
  };
}

function buildNameSectionFields(
  isWaInvite: boolean,
  inviteResponse: ValidateInviteResponse | undefined,
  t: (key: string) => string,
): FormBuilderField[] {
  const fields: FormBuilderField[] = [
    {
      name: "name",
      label: t("fullName"),
      type: "text",
      placeholder: t("namePlaceholder"),
    },
  ];
  if (isWaInvite && inviteResponse?.phone) {
    fields.push({
      name: "phone",
      label: t("phone"),
      type: "display",
      placeholder: inviteResponse.phone,
      description: t("phoneVerifiedViaWhatsapp"),
    });
  }
  fields.push(
    inviteResponse?.email && !isWaInvite
      ? {
          name: "email",
          label: t("email"),
          type: "display",
          placeholder: inviteResponse.email,
        }
      : {
          name: "email",
          label: t("email"),
          type: "email",
          placeholder: t("emailPlaceholder"),
          description: t("weWillUseEmail"),
        },
  );
  return fields;
}

function buildPasswordSectionFields(
  isEmailRequest: boolean,
  isProviderConsent: boolean,
  t: (key: string) => string,
): FormBuilderField[] {
  if (!isEmailRequest && !isProviderConsent) {
    return [
      {
        name: "password",
        label: t("password"),
        type: "password",
        description: t("mustBeAtLeast6"),
      },
      {
        name: "confirmPassword",
        label: t("confirmPassword"),
        type: "password",
        description: t("confirmYourPassword"),
      },
      buildSignupTermsField(t),
    ];
  }
  if (isProviderConsent) {
    return [buildSignupTermsField(t)];
  }
  return [];
}

function buildSignupFields({
  isEmailConfirmation,
  isProviderConsent,
  isEmailRequest,
  inviteResponse,
  containerRef,
  t,
}: {
  isEmailConfirmation: boolean;
  isProviderConsent: boolean;
  isEmailRequest: boolean;
  inviteResponse?: ValidateInviteResponse;
  containerRef: React.RefObject<HTMLDivElement | null>;
  t: (key: string) => string;
}): FormBuilderField[] {
  const isWaInvite = inviteResponse?.channel === 'WHATSAPP';
  const fields: FormBuilderField[] = [];
  if (!isEmailConfirmation && !isProviderConsent) {
    fields.push(...buildNameSectionFields(isWaInvite, inviteResponse, t));
  }
  fields.push(...buildPasswordSectionFields(isEmailRequest, isProviderConsent, t));
  fields.push({
    name: "captcha",
    label: "",
    type: "custom" as const,
    render: () => <div ref={containerRef} className="flex justify-center" />,
  });
  return fields;
}

function handleSignupSuccess({
  data,
  isProviderConsent,
  router,
  setPendingEmail,
  t,
}: {
  data: unknown;
  isProviderConsent: boolean;
  router: ReturnType<typeof useRouter>;
  setPendingEmail: (email: string) => void;
  t: (key: string) => string;
}) {
  if (isProviderConsent) {
    const callbackUrl = (data as { callbackUrl?: string } | undefined)?.callbackUrl;
    router.push(callbackUrl?.startsWith("/") ? callbackUrl : "/redirect");
    return;
  }
  const signupResult = data as (SignupResult & { email: string }) | undefined;
  if (signupResult?.accountCreated === false) {
    setPendingEmail(signupResult.email);
  } else {
    toast.success(t("common:successMessage"));
    router.push("/login");
  }
}

function getSignupInitialValues(inviteResponse?: ValidateInviteResponse) {
  if (!inviteResponse) {
    return { acceptTerms: false, email: "", name: "" };
  }
  return {
    acceptTerms: false,
    // WA invite: email is null, user fills it in; EMAIL invite: pre-filled, locked
    email: inviteResponse.email ?? "",
    name: inviteResponse.name ?? "",
  };
}

function useSignupFormState({
  inviteResponse,
  captcha,
  signupToken,
  isProviderConsent,
  t,
}: {
  inviteResponse?: ValidateInviteResponse;
  captcha?: CaptchaConfigDto | null;
  signupToken?: string;
  isProviderConsent: boolean;
  t: (key: string) => string;
}) {
  const { containerRef, getToken, enabled: captchaEnabled } = useCaptcha(captcha);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const isEmailConfirmation = Boolean(signupToken);
  const isEmailRequest = !inviteResponse && !isEmailConfirmation && !isProviderConsent;
  const isWaInvite = inviteResponse?.channel === 'WHATSAPP';
  const showOAuth = (isEmailRequest || Boolean(inviteResponse)) && !isEmailConfirmation;
  const initialValues = useMemo(() => getSignupInitialValues(inviteResponse), [inviteResponse]);

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().optional(),
          email: z.string().optional(),
          password: z.string().optional(),
          confirmPassword: z.string().optional(),
          acceptTerms: z.boolean().optional(),
        })
        .superRefine((data, ctx) =>
          validateSignupFormSchema(data, ctx, {
            isProviderConsent,
            isEmailRequest,
            isWaInvite,
            t,
          }),
        ),
    [t, isEmailRequest, isProviderConsent, isWaInvite],
  );

  const fields = useMemo<FormBuilderField[]>(
    () =>
      buildSignupFields({
        isEmailConfirmation,
        isProviderConsent,
        isEmailRequest,
        inviteResponse,
        containerRef,
        t,
      }),
    [
      t,
      inviteResponse,
      isEmailConfirmation,
      isEmailRequest,
      isProviderConsent,
      containerRef,
    ],
  );

  return {
    containerRef,
    getToken,
    captchaEnabled,
    pendingEmail,
    setPendingEmail,
    isEmailConfirmation,
    isEmailRequest,
    showOAuth,
    initialValues,
    schema,
    fields,
  };
}

function SignupOAuthSection({
  oauthProviders,
  inviteResponse,
  getToken,
  captchaEnabled,
}: {
  oauthProviders: OAuthProvider[];
  inviteResponse?: ValidateInviteResponse;
  getToken: () => Promise<string | null>;
  captchaEnabled: boolean;
}) {
  const intent = inviteResponse ? "INVITE" : "SIGNUP";
  return (
    <div className="mt-6">
      <OAuthButtons
        providers={oauthProviders}
        intent={intent}
        inviteToken={inviteResponse?.token}
        captchaControl={{
          getToken,
          enabled: captchaEnabled,
        }}
      />
    </div>
  );
}

export function SignupForm({
  inviteResponse,
  oauthProviders = [],
  captcha,
  signupToken,
  isProviderConsent = false,
  inviteAlreadyMember = false,
  providerLabel,
}: {
  inviteResponse?: ValidateInviteResponse;
  oauthProviders?: OAuthProvider[];
  captcha?: CaptchaConfigDto | null;
  signupToken?: string;
  isProviderConsent?: boolean;
  inviteAlreadyMember?: boolean;
  providerLabel?: string;
}) {
  const { t } = useTranslation("signup");
  const router = useRouter();

  const state = useSignupFormState({
    inviteResponse,
    captcha,
    signupToken,
    isProviderConsent,
    t,
  });

  if (state.pendingEmail) {
    return <PendingEmailCard email={state.pendingEmail} onSignIn={() => router.push("/login")} t={t} />;
  }

  if (inviteAlreadyMember) {
    return <InviteAlreadyMemberCard t={t} />;
  }

  const { title, description, submitLabel } = getSignupLabels({
    isEmailConfirmation: state.isEmailConfirmation,
    isProviderConsent,
    isEmailRequest: state.isEmailRequest,
    providerLabel,
    t,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormBuilder
          schema={state.schema}
          fields={state.fields}
          values={state.initialValues}
          onSubmit={async (values) => {
            const captchaToken = await state.getToken();
            if (state.captchaEnabled && !captchaToken)
              throw new Error(t("common:captchaRequired"));

            return executeSignupSubmit({
              values,
              captchaToken,
              isProviderConsent,
              isEmailConfirmation: state.isEmailConfirmation,
              signupToken,
              inviteResponse,
              isEmailRequest: state.isEmailRequest,
              t,
            });
          }}
          onSuccess={(data) =>
            handleSignupSuccess({
              data,
              isProviderConsent,
              router,
              setPendingEmail: state.setPendingEmail,
              t,
            })
          }
          showToast={false}
          submitLabel={submitLabel}
          actions={{
            mode: "submit+link",
            link: {
              label: `${t("alreadyHaveAccount")} ${t("signIn")}`,
              href: "/login",
            },
          }}
        />
        {state.showOAuth && (
          <SignupOAuthSection
            oauthProviders={oauthProviders}
            inviteResponse={inviteResponse}
            getToken={state.getToken}
            captchaEnabled={state.captchaEnabled}
          />
        )}
      </CardContent>
    </Card>
  );
}
