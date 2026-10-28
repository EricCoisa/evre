"use client";

import { LoginFormData } from "@/lib/schemas/login.schema";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LoginRequest, LoginResponse } from "./types";
import { APINEXT } from "@/lib/api/apiNext";
import { captchaHeader } from "@/lib/api/captcha-header";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { getQueryClient } from "@/lib/queryClient";


export async function loginClient(data: LoginFormData, router: AppRouterInstance, captchaToken?: string | null): Promise<LoginResponse> {
   const loginResult = await login(data, captchaToken);
   // Limpa queries antigas e força refetch
   router.push(loginResult.user.routes.find(route => route.isHome)?.path || "/home");
   router.refresh();
   return loginResult;
}

export async function login(credentials: LoginRequest, captchaToken?: string | null): Promise<LoginResponse> {
   // O token vai no header até o route handler, que o repassa ao backend — o
   // corpo continua sendo só e-mail e senha.
   return await APINEXT.POST<LoginResponse>('/auth/login', credentials, {
      headers: captchaHeader(captchaToken),
   });
}

/** Renovação single-flight do token — evita rotações paralelas concorrentes. */
let inFlightRefresh: Promise<void> | null = null;

export function refresh(): Promise<void> {
   if (!inFlightRefresh) {
      inFlightRefresh = APINEXT.POST<void>('/auth/refresh').finally(() => {
         inFlightRefresh = null;
      });
   }
   return inFlightRefresh;
}

export async function logout(msg?: string | undefined): Promise<void> {
   function redirectToLogin() {
      localStorage.clear();
      // Limpa completamente o cache do QueryClient. Este arquivo é "use client", então
      // getQueryClient() devolve a mesma instância que o provider está usando.
      const queryClient = getQueryClient();
      queryClient.cancelQueries();
      queryClient.removeQueries();
      queryClient.clear();
      redirect('/login');
   }

   try {
      await APINEXT.POST('/auth/logout');
   } catch {
      console.error('Erro ao fazer logout, redirecionando para a página de login.');
   }
   if (msg != undefined) {
      toast.info(msg);
      setTimeout(() => {
         redirectToLogin();
      }, 3000);
   } else {
      redirectToLogin()
   }


}
